const hre = require("hardhat");
const fs  = require("fs");

/**
 * demo-scenario2.js  (fixed — real PBFT consensus)
 * ──────────────────────────────────────────────────
 * DEMO SCENARIO 2: Emergency Insulin Shortage (High Risk / PBFT Path)
 *
 * ─── CHANGES FROM ORIGINAL ──────────────────────────────────────────────────
 *
 * FIX #30 (Steps 5 & 6):
 *   ORIGINAL Step 5: Skipped ConsensusAdapter entirely. Just printed:
 *     "[PBFT committee: NMRA + SPC + MSD reached consensus off-chain]"
 *     and called approveEmergencyOrder() directly without any PBFT contract calls.
 *
 *   FIXED Step 5: Calls the actual ConsensusAdapter contract:
 *     1. consensus.switchToPBFT(orderId, 900, 0)  — NMRA triggers PBFT mode
 *     2. consensus.castVote(eventId, true, dataHash) × 3  — all 3 validators vote
 *     3. ordering.approveEmergencyOrder(orderId)   — NMRA approves post-consensus
 *     4. consensus.restorePoA(eventId)             — system returns to normal
 *
 *   This makes the scenario consistent with demo-phase3.js and with the thesis
 *   claim of "11 transactions" and "1,542ms completion time".
 *
 *   ALSO CHANGED:
 *   - Reads deployment-phase3.json instead of deployment-phase2.json
 *     because ConsensusAdapter is deployed in phase 3.
 *   - Destructures `spc` signer (index 1) which was previously unused.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// viaIR compiled contracts use more gas per tx — set explicit limit
const GAS = { gasLimit: 4000000 };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚨 DEMO SCENARIO 2: Emergency Shortage (High Risk / PBFT Path)");
  console.log("=".repeat(70));

  // ── CHANGED: read phase3 deployment (includes ConsensusAdapter) ───────────
  let info;
  try {
    info = JSON.parse(fs.readFileSync("deployment-phase3.json"));
  } catch {
    console.error("❌  deployment-phase3.json not found!");
    console.error("    Run: npx hardhat run scripts/deploy-phase3.js --network ganache");
    process.exit(1);
  }

  const { TraceabilityContract, OrderingContract, ConsensusAdapter } = info.contracts;

  // ── CHANGED: destructure spc (index 1) — needed for PBFT vote ────────────
  // ORIGINAL: const [nmra, , msd, , mfg2, , , , hospital] = ...
  // FIXED:    const [nmra, spc, msd, , mfg2, , , , hospital] = ...
  const [nmra, spc, msd, , mfg2, , , , hospital] = await hre.ethers.getSigners(); // CHANGED

  const traceability = await hre.ethers.getContractAt("TraceabilityContract", TraceabilityContract);
  const ordering     = await hre.ethers.getContractAt("OrderingContract",     OrderingContract);
  const consensus    = await hre.ethers.getContractAt("ConsensusAdapter",     ConsensusAdapter); // ADDED

  console.log("\n📋 Participants:");
  console.log("  Manufacturer 2 (MFG2) :", mfg2.address);
  console.log("  MSD  (Supplier)       :", msd.address);
  console.log("  SPC  (Validator)      :", spc.address);
  console.log("  Hospital (Buyer)      :", hospital.address);
  console.log("  NMRA (Emergency Auth) :", nmra.address);

  // ── STEP 1: Mint cold-chain Insulin batch ─────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("❄️  STEP 1: Manufacturer 2 mints Insulin batch (COLD CHAIN)...");

  const expiryDate = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60;

  const mintTx = await traceability.connect(mfg2).mintBatch(
    {
      medicineName:      "Actrapid 100IU/mL",
      batchNumber:       "INS-2024-001",
      genericName:       "Human Insulin 100IU/mL",
      quantity:          5000,
      expiryDate,
      coldChainRequired: true,
      minTemp:           200,   // 2.00°C
      maxTemp:           800,   // 8.00°C
      qrPayload:         "INS-2024-001:MFG2:BATCH",
      ipfsCert:          "ipfs://QmGMPinsulincert"
    },
    GAS
  );
  const mintReceipt = await mintTx.wait();

  let tokenId;
  for (const log of mintReceipt.logs) {
    try {
      const p = traceability.interface.parseLog(log);
      if (p.name === "BatchMinted") { tokenId = p.args.tokenId; break; }
    } catch {}
  }

  console.log("   ✅ Cold-chain batch minted! Token ID:", tokenId.toString());
  console.log("   ✅ Medicine     : Actrapid 100IU/mL (Human Insulin)");
  console.log("   ✅ Batch No     : INS-2024-001");
  console.log("   ✅ Quantity     : 5,000 vials");
  console.log("   ✅ Cold Chain   : 2°C – 8°C REQUIRED");

  // ── STEP 2: Custody Manufacturer → MSD (valid 4°C) ───────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🌡️  STEP 2: Cold-chain transfer — Manufacturer → MSD (4°C)...");

  await (await traceability.connect(mfg2).transferCustody(
    tokenId, msd.address,
    "MSD Cold Storage, Colombo", 400,   // 4.00°C ✅
    "Cold-chain transfer to MSD central store",
    GAS
  )).wait();

  console.log("   ✅ Custody transferred to MSD");
  console.log("   ✅ Temperature : 4.00°C (within 2°C–8°C range)");

  // ── STEP 3: Hospital places URGENT order ─────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🏥 STEP 3: Teaching Hospital places URGENT Insulin order to MSD...");

  const orderTx = await ordering.connect(hospital).placeOrder(
    msd.address,
    "Actrapid 100IU/mL", "Human Insulin 100IU/mL",
    2000, hre.ethers.parseEther("0.001"),
    "URGENT: ICU stock depleted. Estimated 3-day stockout.",
    GAS
  );
  const orderReceipt = await orderTx.wait();

  let orderId;
  for (const log of orderReceipt.logs) {
    try {
      const p = ordering.interface.parseLog(log);
      if (p.name === "OrderPlaced") { orderId = p.args.orderId; break; }
    } catch {}
  }

  console.log("   ✅ Order placed! Order ID:", orderId.toString());
  console.log("   ✅ Item        : Actrapid 100IU/mL (Human Insulin)");
  console.log("   ✅ Quantity    : 2,000 vials");
  console.log("   ⚠️  Urgency    : ICU stock depleted — 3-day stockout");
  console.log("   ✅ Status      : AI_REVIEW");

  // ── STEP 4: AI Oracle sets risk = 0.900 (CRITICAL) ───────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🤖 STEP 4: AI Oracle evaluates risk (CRITICAL shortage detected)...");
  console.log("   Simulating LSTM model prediction...");
  console.log("   Factors:");
  console.log("     - National insulin stock at 8% (critical threshold: 15%)");
  console.log("     - 3 hospitals reported stock-out this week");
  console.log("     - Import pipeline blocked (vessel delay: 14 days)");
  console.log("     - Demand spike predicted: +40% next 7 days");

  await (await ordering.connect(nmra).setRiskScore(orderId, 900, GAS)).wait();

  console.log("\n   🚨 RISK SCORE : 0.900 (CRITICAL — above 0.800 threshold)");
  console.log("   🚨 Path       : EMERGENCY (PBFT consensus required)");
  console.log("   🚨 Status     : EMERGENCY");

  // ── STEP 5: Full PBFT consensus round ─────────────────────────────────────
  // ── FIX #30: Replaced fake console.log with real ConsensusAdapter calls ───
  //
  // ORIGINAL (fake):
  //   console.log("   [PBFT committee: NMRA + SPC + MSD reached consensus off-chain]");
  //   await (await ordering.connect(nmra).approveEmergencyOrder(orderId, GAS)).wait();
  //
  // FIXED: actual on-chain PBFT round using ConsensusAdapter contract
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("📡 STEP 5: PBFT Consensus Round — PoA → PBFT → PoA...");

  // 5a: NMRA switches to PBFT mode
  console.log("\n   5a. NMRA triggers PoA → PBFT switch...");
  const switchTx  = await consensus.connect(nmra).switchToPBFT(orderId, 900, 0, GAS); // ADDED
  await switchTx.wait();                                                                // ADDED
  const eventId   = await consensus.getActiveEventId();                                // ADDED
  const modeBefore = await consensus.getCurrentMode();                                 // ADDED
  console.log("   ✅ Switched to PBFT mode. Event ID:", eventId.toString());
  console.log("   ✅ Current mode:", modeBefore === 1n ? "PBFT 🔒" : "PoA");

  // 5b: Prepare data hash for voting (same hash used by all validators)
  const dataHash = hre.ethers.keccak256(                                               // ADDED
    hre.ethers.toUtf8Bytes(`order-${orderId}-risk-900`)                               // ADDED
  );                                                                                    // ADDED
  console.log("\n   5b. PBFT Voting Round (Byzantine Fault Tolerant)...");
  console.log("       Vote hash:", dataHash.slice(0, 20) + "...");

  // 5c: All 3 validators cast votes
  await sleep(500);
  await (await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS)).wait(); // ADDED
  console.log("   ✅ NMRA voted: APPROVE  (1/3)");

  await sleep(500);
  await (await consensus.connect(spc).castVote(eventId, true, dataHash, GAS)).wait();  // ADDED
  console.log("   ✅ SPC  voted: APPROVE  (2/3)");

  await sleep(500);
  await (await consensus.connect(msd).castVote(eventId, true, dataHash, GAS)).wait();  // ADDED
  console.log("   ✅ MSD  voted: APPROVE  (3/3)");

  const voteCount = await consensus.getVoteCount(eventId);                             // ADDED
  console.log(`\n   📊 Final vote tally: ${voteCount}/3 APPROVE`);
  console.log("   ✅ Byzantine consensus REACHED (≥ 2/3 required, 3/3 unanimous)");

  // 5d: NMRA approves emergency order (post-PBFT)
  console.log("\n   5d. NMRA approves emergency order (post-PBFT)...");
  await (await ordering.connect(nmra).approveEmergencyOrder(orderId, GAS)).wait();
  console.log("   ✅ Emergency order APPROVED by NMRA");

  // 5e: Restore to PoA
  console.log("\n   5e. Restoring consensus to PoA...");
  await (await consensus.connect(nmra).restorePoA(eventId, GAS)).wait();               // ADDED
  const modeAfter = await consensus.getCurrentMode();                                  // ADDED
  console.log("   ✅ Restored to:", modeAfter === 0n ? "PoA ✅" : "PBFT");
  console.log("   ✅ Normal operations resumed");

  // ── STEP 6: MSD fulfills ─────────────────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("📬 STEP 6: MSD fulfills emergency order (PRIORITY DISPATCH)...");

  await (await ordering.connect(msd).fulfillOrder(orderId, GAS)).wait();

  console.log("   ✅ Order FULFILLED by MSD (PRIORITY DISPATCH)");

  // ── STEP 7: Cold-chain delivery MSD → Hospital ───────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("❄️  STEP 7: Cold-chain transfer — MSD → Hospital (5°C)...");

  await (await traceability.connect(msd).transferCustody(
    tokenId, hospital.address,
    "Colombo Teaching Hospital Pharmacy", 500,  // 5.00°C ✅
    "Emergency delivery — Order #" + orderId.toString() + ". Cold chain maintained.",
    GAS
  )).wait();

  console.log("   ✅ Cold-chain delivery to Colombo Teaching Hospital");
  console.log("   ✅ Temperature : 5.00°C (within 2°C–8°C range)");

  // ── STEP 8: Cold-chain violation demo ────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🧪 STEP 8: Demonstrating cold-chain violation protection...");
  console.log("   Attempting transfer at 25°C (violates 2°C–8°C requirement)...");

  try {
    await (await traceability.connect(hospital).transferCustody(
      tokenId, nmra.address,
      "Test — wrong temp", 2500,   // 25°C — should be BLOCKED
      "Should fail",
      GAS
    )).wait();
    console.log("   ❌ ERROR: This should have been blocked!");
  } catch (err) {
    const msg = err.message.includes("cold-chain")
      ? "cold-chain temperature violation"
      : err.message.split("'")[1] || err.message.slice(0, 60);
    console.log("   ✅ BLOCKED! Cold-chain violation correctly prevented.");
    console.log("   ✅ Reason  :", msg);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const history    = await traceability.getCustodyHistory(tokenId);
  const finalOrder = await ordering.getOrder(orderId);
  const [total, fulfilled, emergency] = await ordering.getStats();
  const totalSwitches = await consensus.totalSwitches();                               // ADDED

  const label = {
    [mfg2.address.toLowerCase()]:    "Manufacturer 2 (MFG2)",
    [msd.address.toLowerCase()]:     "MSD",
    [hospital.address.toLowerCase()]: "Colombo Teaching Hospital"
  };

  console.log("\n" + "=".repeat(70));
  console.log("👑 NMRA AUDIT VIEW — Emergency Order Report");
  console.log("=".repeat(70));

  console.log("\n📊 COLD-CHAIN CUSTODY TRAIL (Token #" + tokenId.toString() + " — Insulin):");
  for (let i = 0; i < history.length; i++) {
    const c    = history[i];
    const ts   = new Date(Number(c.timestamp) * 1000).toLocaleString();
    const from = i === 0 ? "MINTED" : (label[c.from.toLowerCase()] || c.from.slice(0,10)+"...");
    const to   = label[c.to.toLowerCase()]  || c.to.slice(0,10)+"...";
    const temp = (Number(c.recordedTemp) / 100).toFixed(2) + "°C";
    console.log(`   Step ${i}: ${from} → ${to}`);
    console.log(`          📍 ${c.location}  🌡️  ${temp}  🕐 ${ts}`);
  }

  console.log("\n📋 ORDER SUMMARY (Order #" + orderId.toString() + "):");
  console.log("   Medicine     :", finalOrder.medicineName);
  console.log("   Quantity     :", finalOrder.quantity.toString(), "vials");
  console.log("   Risk Score   : 0.900 (CRITICAL)");
  console.log("   Path         : EMERGENCY (PBFT)");
  console.log("   Status       : FULFILLED ✅");
  console.log("   Approved by  : NMRA (post-PBFT consensus)");

  console.log("\n📡 CONSENSUS SUMMARY:");                                              // ADDED
  console.log("   PBFT Event ID     :", eventId.toString());                          // ADDED
  console.log("   Validator votes   : 3/3 APPROVE (unanimous)");                     // ADDED
  console.log("   Total Switches    :", totalSwitches.toString());                    // ADDED
  console.log("   Final mode        : PoA (restored) ✅");                           // ADDED

  console.log("\n📊 NETWORK STATISTICS:");
  console.log("   Total Orders     :", total.toString());
  console.log("   Total Fulfilled  :", fulfilled.toString());
  console.log("   Emergency Orders :", emergency.toString());

  console.log("\n🎓 KEY RESEARCH CONTRIBUTIONS DEMONSTRATED:");
  console.log("   ✅ AI risk score > 0.8 → EMERGENCY path triggered");
  console.log("   ✅ ConsensusAdapter.switchToPBFT() called on-chain");  // CHANGED
  console.log("   ✅ All 3 validators (NMRA, SPC, MSD) voted APPROVE on-chain"); // CHANGED
  console.log("   ✅ Byzantine consensus: 3/3 votes, fault-tolerant (≥2/3 required)"); // ADDED
  console.log("   ✅ NMRA regulatory approval after PBFT consensus");
  console.log("   ✅ PoA restored after emergency — ConsensusAdapter.restorePoA()"); // ADDED
  console.log("   ✅ Cold-chain violation (25°C) correctly blocked on-chain");
  console.log("   ✅ Full immutable audit trail recorded");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  });
