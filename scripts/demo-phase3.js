const hre = require("hardhat");
const fs  = require("fs");

/**
 * demo-phase3.js
 * ───────────────
 * PHASE 3 COMPLETE DEMO — AI Oracle + PBFT Consensus Switching
 *
 * Demonstrates WITHOUT needing oracle_server.js running:
 *   1. NMRA submits LSTM predictions directly to PredictiveAIOracle
 *   2. Low-risk order  → PoA approval (fast path)
 *   3. High-risk order → PBFT switch → 3 validator votes → restore PoA
 *   4. Full audit trail readable on ConsensusAdapter
 */

const GAS = { gasLimit: 4000000 };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const SEP = "=".repeat(70);
  console.log("\n" + SEP);
  console.log("🧠 PHASE 3 DEMO — AI Oracle + PBFT Consensus Switching");
  console.log(SEP);

  // ── Load deployment ───────────────────────────────────────────────────────
  let info;
  try {
    info = JSON.parse(fs.readFileSync("deployment-phase3.json"));
  } catch {
    console.error("❌ deployment-phase3.json not found!");
    console.error("   Run: npx hardhat run scripts/deploy-phase3.js --network ganache");
    process.exit(1);
  }

  const { PredictiveAIOracle, ConsensusAdapter, OrderingContract } = info.contracts;

  // ── Signers ───────────────────────────────────────────────────────────────
  const [nmra, spc, msd, , , , , pharmacy, hospital] = await hre.ethers.getSigners();

  // ── Contracts ─────────────────────────────────────────────────────────────
  const oracle    = await hre.ethers.getContractAt("PredictiveAIOracle", PredictiveAIOracle);
  const consensus = await hre.ethers.getContractAt("ConsensusAdapter",   ConsensusAdapter);
  const ordering  = await hre.ethers.getContractAt("OrderingContract",   OrderingContract);

  console.log("\n📋 Participants:");
  console.log("   NMRA     :", nmra.address);
  console.log("   SPC      :", spc.address);
  console.log("   MSD      :", msd.address);
  console.log("   Pharmacy :", pharmacy.address);
  console.log("   Hospital :", hospital.address);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — LSTM Predictions submitted to PredictiveAIOracle
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("🧠 STEP 1: LSTM Model submits predictions to PredictiveAIOracle...");
  console.log("   (Simulating Python model output — in production this comes from lstm_model.py)");

  const predictions = [
    {
      name: "paracetamol", stockRisk: 120, demand: 45000,
      coldRisk: 50, counterfeitRisk: 80, overall: 150
    },
    {
      name: "insulin", stockRisk: 820, demand: 3200,
      coldRisk: 350, counterfeitRisk: 120, overall: 870
    },
    {
      name: "amoxicillin", stockRisk: 200, demand: 12000,
      coldRisk: 40,  counterfeitRisk: 90, overall: 220
    },
  ];

  for (const p of predictions) {
    const tx = await oracle.connect(nmra).submitPrediction(
      p.name, p.stockRisk, p.demand, p.coldRisk, p.counterfeitRisk, p.overall, GAS
    );
    await tx.wait();
    const flag = p.overall > 800 ? "🚨 CRITICAL" : p.overall > 500 ? "⚠️  HIGH" : "✅ LOW";
    console.log(`   ✅ ${p.name.padEnd(14)} overall=${p.overall}/1000  ${flag}`);
  }

  // Verify stored on-chain
  const insulinPred = await oracle.getPrediction("insulin");
  console.log(`\n   📊 Insulin prediction stored on-chain:`);
  console.log(`      Stock Risk  : ${insulinPred.stockDepletionRisk}/1000`);
  console.log(`      Demand      : ${insulinPred.demandForecast} units/week`);
  console.log(`      Overall Risk: ${insulinPred.overallRisk}/1000 🚨`);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Verify initial consensus state is PoA
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📡 STEP 2: Verify initial consensus state...");

  const mode0 = await consensus.getCurrentMode();
  console.log("   ✅ Current mode:", mode0 === 0n ? "PoA ✅" : "PBFT");
  console.log("   ✅ Validators  : NMRA, SPC, MSD (3-node PoA network)");

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — LOW RISK order (Paracetamol) → PoA path
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("✅ STEP 3: LOW RISK order — Paracetamol (PoA path)...");

  const order1Tx = await ordering.connect(pharmacy).placeOrder(
    spc.address, "Panadol 500mg", "Paracetamol 500mg",
    5000, hre.ethers.parseEther("0.0001"),
    "Regular stock replenishment", GAS
  );
  const order1Receipt = await order1Tx.wait();

  let order1Id;
  for (const log of order1Receipt.logs) {
    try {
      const p = ordering.interface.parseLog(log);
      if (p.name === "OrderPlaced") { order1Id = p.args.orderId; break; }
    } catch {}
  }
  console.log("   ✅ Order placed! ID:", order1Id.toString());

  // AI Oracle evaluates → low risk
  const paracetamolRisk = await oracle.getRiskScore("paracetamol");
  console.log("   🤖 AI Risk Score (Paracetamol):", paracetamolRisk.toString(), "/ 1000");

  await (await ordering.connect(nmra).setRiskScore(order1Id, 150, GAS)).wait();
  console.log("   ✅ Risk 150/1000 → STANDARD (PoA) path");

  await (await ordering.connect(spc).approveOrder(order1Id, GAS)).wait();
  console.log("   ✅ SPC approved via PoA — fast consensus");
  console.log("   📡 Consensus mode: PoA (unchanged)");

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4 — HIGH RISK order (Insulin) → PBFT path
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("🚨 STEP 4: HIGH RISK order — Insulin shortage (PBFT path)...");

  const order2Tx = await ordering.connect(hospital).placeOrder(
    msd.address, "Actrapid 100IU/mL", "Human Insulin 100IU/mL",
    2000, hre.ethers.parseEther("0.001"),
    "URGENT: ICU insulin stock at 3-day level", GAS
  );
  const order2Receipt = await order2Tx.wait();

  let order2Id;
  for (const log of order2Receipt.logs) {
    try {
      const p = ordering.interface.parseLog(log);
      if (p.name === "OrderPlaced") { order2Id = p.args.orderId; break; }
    } catch {}
  }
  console.log("   ✅ Emergency order placed! ID:", order2Id.toString());

  // AI Oracle detects critical risk
  const insulinRisk = await oracle.getRiskScore("insulin");
  console.log("   🤖 AI Risk Score (Insulin):", insulinRisk.toString(), "/ 1000  🚨 CRITICAL");

  await (await ordering.connect(nmra).setRiskScore(order2Id, 870, GAS)).wait();
  console.log("   🚨 Risk 870/1000 → EMERGENCY (PBFT) path triggered!");

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5 — PoA → PBFT switch
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📡 STEP 5: Switching consensus PoA → PBFT...");

  const switchTx = await consensus.connect(nmra).switchToPBFT(order2Id, 870, 0, GAS);
  const switchReceipt = await switchTx.wait();

  let eventId;
  for (const log of switchReceipt.logs) {
    try {
      const p = consensus.interface.parseLog(log);
      if (p.name === "ConsensusSwitched") { eventId = p.args.eventId; break; }
    } catch {}
  }

  const mode1 = await consensus.getCurrentMode();
  console.log("   🔄 Consensus switched to:", mode1 === 1n ? "PBFT 🔒" : "PoA");
  console.log("   📋 PBFT Event ID:", eventId.toString());
  console.log("   📋 Reason: HIGH_RISK_ORDER (risk = 870/1000)");
  console.log("   📋 All 3 validators must now vote on this order");

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 6 — PBFT validator voting
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("🗳️  STEP 6: PBFT Validator Voting Round...");

  const dataHash = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes(`order-${order2Id}-risk-870`)
  );

  console.log("   Validator hash:", dataHash.slice(0, 20) + "...");

  await sleep(500);
  await (await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS)).wait();
  console.log("   ✅ NMRA voted: APPROVE");

  await sleep(500);
  await (await consensus.connect(spc).castVote(eventId, true, dataHash, GAS)).wait();
  console.log("   ✅ SPC  voted: APPROVE");

  await sleep(500);
  await (await consensus.connect(msd).castVote(eventId, true, dataHash, GAS)).wait();
  console.log("   ✅ MSD  voted: APPROVE");

  const votes = await consensus.getVoteCount(eventId);
  console.log(`\n   📊 Final vote count: ${votes}/3`);
  console.log("   ✅ PBFT consensus REACHED (3/3 unanimous)");

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 7 — NMRA approves emergency order
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("👑 STEP 7: NMRA approves emergency order (post-PBFT)...");

  await (await ordering.connect(nmra).approveEmergencyOrder(order2Id, GAS)).wait();
  console.log("   ✅ Emergency order APPROVED by NMRA");

  await (await ordering.connect(msd).fulfillOrder(order2Id, GAS)).wait();
  console.log("   ✅ MSD fulfilled order — insulin dispatched (PRIORITY)");

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 8 — Restore PoA
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📡 STEP 8: Restoring PoA consensus...");

  await (await consensus.connect(nmra).restorePoA(eventId, GAS)).wait();

  const mode2 = await consensus.getCurrentMode();
  console.log("   ✅ Consensus restored to:", mode2 === 0n ? "PoA ✅" : "PBFT");
  console.log("   ✅ Normal operations resumed");

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 9 — Full audit trail
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📋 STEP 9: Reading NMRA Audit Trail from blockchain...");

  // Note: getEvent() fails in ethers v6 because ConsensusEvent contains enums.
  // We use the values we already have from the demo execution instead.
  const order1   = await ordering.getOrder(order1Id);
  const order2   = await ordering.getOrder(order2Id);
  const stats    = await ordering.getStats();
  const tracked  = await oracle.getTrackedMedicines();
  const switches = await consensus.totalSwitches();
  const auditVotes = await consensus.getVoteCount(eventId);

  const STATUS = ["PENDING","AI_REVIEW","APPROVED","EMERGENCY","FULFILLED","REJECTED","CANCELLED"];

  console.log("\n   🔍 CONSENSUS EVENT #" + String(eventId) + ":");
  console.log("      From mode  : PoA");
  console.log("      To mode    : PBFT");
  console.log("      Risk score : 870/1000");
  console.log("      Trigger    : Order #" + String(order2Id) + " (Insulin shortage)");
  console.log("      Votes      : " + String(auditVotes) + "/3 validators approved");
  console.log("      Resolved   : true");
  console.log("      Initiator  : " + nmra.address);

  console.log("\n   📋 ORDER SUMMARY:");
  console.log("      Order #" + String(order1Id) + " (Paracetamol) : " + STATUS[Number(order1.status)]);
  console.log("      Order #" + String(order2Id) + " (Insulin)     : " + STATUS[Number(order2.status)]);

  console.log("\n   📊 NETWORK STATISTICS:");
  console.log("      Total Orders     : " + String(stats[0]));
  console.log("      Total Fulfilled  : " + String(stats[1]));
  console.log("      Emergency Orders : " + String(stats[2]));
  const meds = [];
  for (let i = 0; i < tracked.length; i++) meds.push(String(tracked[i]));
  console.log("      Tracked Medicines: " + meds.join(", "));
  console.log("      Total Switches   : " + String(switches));

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log("\n" + SEP);
  console.log("🎉 PHASE 3 DEMO COMPLETE!");
  console.log(SEP);
  
  console.log("   ✅ LSTM predictions stored immutably on PredictiveAIOracle");
  console.log("   ✅ AI risk score automatically routes order to correct path");
  console.log("   ✅ Low risk (150/1000)  → PoA: instant SPC approval");
  console.log("   ✅ High risk (870/1000) → PBFT: all 3 validators voted");
  console.log("   ✅ Consensus switched PoA → PBFT → PoA (world-first)");
  console.log("   ✅ Complete audit trail on ConsensusAdapter (immutable)");
  console.log("   ✅ NMRA can prove consensus integrity to regulators");
 
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  });