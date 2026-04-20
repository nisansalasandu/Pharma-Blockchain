/**
 * oracle_server.js
 * ─────────────────
 * Sri Lanka PharmaChain — Oracle & PBFT Coordinator
 *
 * INSTALL BEFORE RUNNING:
 *   npm install express cors ethers
 *
 * RUN from project root:
 *   node pbft_coordinator/oracle_server.js
 */

"use strict";

// ── Step 1: Check required packages exist ────────────────────────────────
const REQUIRED = ["express", "cors", "ethers"];
for (const pkg of REQUIRED) {
  try { require.resolve(pkg); }
  catch {
    console.error(`\n❌ Missing package: "${pkg}"`);
    console.error(`   Fix: npm install ${REQUIRED.join(" ")}`);
    process.exit(1);
  }
}

const express    = require("express");
const cors       = require("cors");
const { ethers } = require("ethers");
const fs         = require("fs");
const path       = require("path");

// ── Configuration ─────────────────────────────────────────────────────────
const PORT                = 3001;
const GANACHE_URL         = "http://127.0.0.1:7545";
const EMERGENCY_THRESHOLD = 800;
const GAS                 = { gasLimit: 4000000 };

console.log("\n" + "=".repeat(60));
console.log("🌐 SRI LANKA PHARMACHAIN — ORACLE & PBFT COORDINATOR");
console.log("=".repeat(60));

// ── Step 2: Load deployment-phase3.json ──────────────────────────────────
console.log("\n📂 Loading deployment info...");
let deployment;
try {
  deployment = JSON.parse(fs.readFileSync("deployment-phase3.json", "utf8"));
  console.log("   ✅ deployment-phase3.json loaded");
  console.log("   Oracle  :", deployment.contracts.PredictiveAIOracle);
  console.log("   Consensus:", deployment.contracts.ConsensusAdapter);
  console.log("   Ordering :", deployment.contracts.OrderingContract);
} catch (err) {
  console.error("   ❌ deployment-phase3.json not found or invalid!");
  console.error("      Fix: npx hardhat run scripts/deploy-phase3.js --network ganache");
  process.exit(1);
}

// ── Step 3: Load ABIs ─────────────────────────────────────────────────────
console.log("\n📄 Loading contract ABIs...");
function loadABI(name) {
  const p = path.join("artifacts", "contracts", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`   ❌ ABI missing: ${p}`);
    console.error("      Fix: npx hardhat compile");
    process.exit(1);
  }
  console.log(`   ✅ ${name}`);
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}
const oracleABI    = loadABI("PredictiveAIOracle");
const consensusABI = loadABI("ConsensusAdapter");
const orderingABI  = loadABI("OrderingContract");

// ── Step 4: Read mnemonic from hardhat.config.js ──────────────────────────
console.log("\n🔑 Reading mnemonic from hardhat.config.js...");
let mnemonic;
try {
  const config = fs.readFileSync("hardhat.config.js", "utf8");
  const match  = config.match(/mnemonic\s*:\s*["']([^"']+)["']/);
  if (!match || match[1] === "YOUR_GANACHE_MNEMONIC_HERE") {
    throw new Error("Mnemonic not set — replace YOUR_GANACHE_MNEMONIC_HERE in hardhat.config.js");
  }
  mnemonic = match[1];
  console.log("   ✅ Mnemonic found (" + mnemonic.split(" ").length + " words)");
} catch (err) {
  console.error("   ❌", err.message);
  process.exit(1);
}

// ── Step 5: Connect to Ganache ────────────────────────────────────────────
console.log("\n🔗 Connecting to Ganache at", GANACHE_URL, "...");
const provider = new ethers.JsonRpcProvider(GANACHE_URL);

// Derive wallet signers from mnemonic
function deriveWallet(index) {
  const node = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(mnemonic),
    `m/44'/60'/0'/0/${index}`
  );
  return new ethers.Wallet(node.privateKey, provider);
}

let nmraSigner, spcSigner, msdSigner;
let oracleContract, consensusContract, orderingContract;

async function initBlockchain() {
  // Test connection first
  try {
    await provider.getBlockNumber();
    console.log("   ✅ Ganache is running");
  } catch {
    console.error("   ❌ Cannot connect to Ganache at", GANACHE_URL);
    console.error("      Make sure Ganache is running on port 8545");
    process.exit(1);
  }

  nmraSigner = deriveWallet(0);
  spcSigner  = deriveWallet(1);
  msdSigner  = deriveWallet(2);

  console.log("   ✅ NMRA:", nmraSigner.address);
  console.log("   ✅ SPC :", spcSigner.address);
  console.log("   ✅ MSD :", msdSigner.address);

  oracleContract    = new ethers.Contract(deployment.contracts.PredictiveAIOracle, oracleABI,    nmraSigner);
  consensusContract = new ethers.Contract(deployment.contracts.ConsensusAdapter,   consensusABI, nmraSigner);
  orderingContract  = new ethers.Contract(deployment.contracts.OrderingContract,   orderingABI,  nmraSigner);

  // Verify contracts respond
  try {
    await oracleContract.totalPredictions();
    console.log("   ✅ PredictiveAIOracle responding");
  } catch {
    console.error("   ❌ PredictiveAIOracle not responding — re-run deploy-phase3.js");
    process.exit(1);
  }

  try {
    const mode = await consensusContract.getCurrentMode();
    console.log("   ✅ ConsensusAdapter responding — mode:", mode === 0n ? "PoA" : "PBFT");
  } catch {
    console.error("   ❌ ConsensusAdapter not responding — re-run deploy-phase3.js");
    process.exit(1);
  }
}

// ── Prediction cache ───────────────────────────────────────────────────────
const cache = {};

// ── Express app ───────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cors());

// ─────────────────────────────────────────────────────────────────────────
// POST /submit-prediction
// Called by lstm_model.py with LSTM risk output
// ─────────────────────────────────────────────────────────────────────────
app.post("/submit-prediction", async (req, res) => {
  const { medicine, stockRisk, demandForecast, coldChainRisk, counterfeitRisk, overallRisk } = req.body;

  if (!medicine || overallRisk === undefined) {
    return res.status(400).json({ error: "Missing fields: medicine, overallRisk required" });
  }

  const key = medicine.toLowerCase();
  console.log(`\n📥 [${new Date().toLocaleTimeString()}] Prediction: ${key} | risk=${overallRisk}/1000`);

  // Cache locally
  cache[key] = { medicine: key, stockRisk, demandForecast, coldChainRisk, counterfeitRisk, overallRisk, ts: Date.now() };

  // Submit to blockchain
  try {
    const tx = await oracleContract.submitPrediction(
      key,
      stockRisk    || 0,
      demandForecast || 0,
      coldChainRisk  || 0,
      counterfeitRisk || 0,
      overallRisk,
      GAS
    );
    const receipt = await tx.wait();
    console.log(`   ⛓️  On-chain: ${receipt.hash.slice(0, 20)}...`);
    if (overallRisk > EMERGENCY_THRESHOLD) {
      console.log(`   🚨 CRITICAL RISK — ${key} at ${overallRisk}/1000`);
    }
    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    console.error("   ❌ Blockchain error:", err.message.slice(0, 100));
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /predictions  — latest cached predictions
// ─────────────────────────────────────────────────────────────────────────
app.get("/predictions", (req, res) => {
  res.json({ timestamp: new Date().toISOString(), predictions: Object.values(cache) });
});

// ─────────────────────────────────────────────────────────────────────────
// GET /consensus-status
// ─────────────────────────────────────────────────────────────────────────
app.get("/consensus-status", async (req, res) => {
  try {
    const mode    = await consensusContract.getCurrentMode();
    const eventId = await consensusContract.getActiveEventId();
    res.json({ mode: mode === 0n ? "PoA" : "PBFT", activeEvent: String(eventId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /manual-evaluate  — manually trigger risk evaluation for an order
// ─────────────────────────────────────────────────────────────────────────
app.post("/manual-evaluate", async (req, res) => {
  const { orderId, medicineName } = req.body;
  if (!orderId || !medicineName) return res.status(400).json({ error: "orderId + medicineName required" });
  await evaluateOrder(parseInt(orderId), medicineName);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────
// Order event listener
// ─────────────────────────────────────────────────────────────────────────
async function startOrderListener() {
  console.log("\n👂 Listening for OrderPlaced events...");
  orderingContract.on("OrderPlaced", async (orderId, placer, supplier, medicineName, quantity) => {
    console.log(`\n📋 New Order #${String(orderId)} — ${medicineName} (${String(quantity)} units)`);
    await evaluateOrder(Number(orderId), medicineName);
  });
  console.log("   ✅ Event listener active");
}

async function evaluateOrder(orderId, medicineName) {
  const key    = medicineName.toLowerCase().split(" ")[0];
  const cached = cache[key] || cache[medicineName.toLowerCase()];
  const risk   = cached ? cached.overallRisk : 300;

  if (!cached) console.log(`   ⚠️  No prediction for "${key}" — using default 300`);

  try {
    await (await orderingContract.setRiskScore(orderId, risk, GAS)).wait();
    console.log(`   ✅ Risk ${risk}/1000 set for Order #${orderId}`);

    await (await oracleContract.evaluateOrder(orderId, key, GAS)).wait();

    if (risk > EMERGENCY_THRESHOLD) await triggerPBFT(orderId, risk);
  } catch (err) {
    console.error(`   ❌ evaluateOrder error: ${err.message.slice(0, 100)}`);
  }
}

async function triggerPBFT(orderId, risk) {
  console.log(`\n🚨 PBFT TRIGGER — Order #${orderId} risk=${risk}/1000`);
  try {
    const tx1     = await consensusContract.switchToPBFT(orderId, risk, 0, GAS);
    await tx1.wait();
    const eventId = await consensusContract.getActiveEventId();
    console.log(`   📡 Switched to PBFT (Event #${String(eventId)})`);

    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(`order-${orderId}-risk-${risk}`));

    await sleep(1000);
    await (await consensusContract.connect(nmraSigner).castVote(eventId, true, dataHash, GAS)).wait();
    console.log("   ✅ NMRA voted APPROVE");

    await sleep(1000);
    await (await consensusContract.connect(spcSigner).castVote(eventId, true, dataHash, GAS)).wait();
    console.log("   ✅ SPC  voted APPROVE");

    await sleep(1000);
    await (await consensusContract.connect(msdSigner).castVote(eventId, true, dataHash, GAS)).wait();
    console.log("   ✅ MSD  voted APPROVE");

    await (await orderingContract.approveEmergencyOrder(orderId, GAS)).wait();
    console.log(`   ✅ Emergency Order #${orderId} approved`);

    await sleep(1000);
    await (await consensusContract.restorePoA(eventId, GAS)).wait();
    console.log("   📡 Restored to PoA");
    console.log(`   🎉 PBFT Event #${String(eventId)} complete`);
  } catch (err) {
    console.error(`   ❌ PBFT error: ${err.message.slice(0, 150)}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Start ──────────────────────────────────────────────────────────────────
async function main() {
  await initBlockchain();
  await startOrderListener();

  app.listen(PORT, () => {
    console.log(`\n🚀 Oracle server running at http://localhost:${PORT}`);
    console.log("\n   Endpoints:");
    console.log(`   POST /submit-prediction   ← lstm_model.py sends here`);
    console.log(`   GET  /predictions          ← current risk scores`);
    console.log(`   GET  /consensus-status     ← PoA or PBFT?`);
    console.log(`   POST /manual-evaluate      ← test an order manually`);
    console.log("\n   Now start the AI model:");
    console.log("   python ai_model/lstm_model.py\n");
  });
}

main().catch(err => {
  console.error("\n❌ Fatal startup error:", err.message);
  process.exit(1);
});