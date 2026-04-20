const hre = require("hardhat");
const fs  = require("fs");

/**
 * demo-scenario1.js  (gas-fixed version)
 * ────────────────────────────────────────
 * DEMO SCENARIO 1: Normal Paracetamol Order (Low Risk / PoA Path)
 *
 * FIX: Every transaction now passes { gasLimit: 500000 }
 *      to avoid Ganache "out of gas" from cumulative block gas.
 */

// viaIR compiled contracts use more gas per tx — set explicit limit
const GAS = { gasLimit: 4000000 };

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🎯 DEMO SCENARIO 1: Normal Pharmacy Order (Low Risk / PoA Path)");
  console.log("=".repeat(70));

  let info;
  try {
    info = JSON.parse(fs.readFileSync("deployment-phase2.json"));
  } catch {
    console.error("❌  deployment-phase2.json not found!");
    console.error("    Run: npx hardhat run scripts/deploy-phase2.js --network ganache");
    process.exit(1);
  }

  const { RoleAccessControl, TraceabilityContract, OrderingContract } = info.contracts;
  const [nmra, spc, , mfg1, , , , pharmacy] = await hre.ethers.getSigners();

  const traceability = await hre.ethers.getContractAt("TraceabilityContract", TraceabilityContract);
  const ordering     = await hre.ethers.getContractAt("OrderingContract",     OrderingContract);

  console.log("\n📋 Participants:");
  console.log("  Manufacturer (MFG1) :", mfg1.address);
  console.log("  SPC (Supplier)      :", spc.address);
  console.log("  Pharmacy (Buyer)    :", pharmacy.address);

  // ── STEP 1: Mint batch ────────────────────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("📦 STEP 1: Manufacturer 1 mints Paracetamol batch...");

  const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  const mintTx = await traceability.connect(mfg1).mintBatch(
    {
      medicineName:      "Panadol 500mg",
      batchNumber:       "PCM-2024-001",
      genericName:       "Paracetamol 500mg",
      quantity:          50000,
      expiryDate,
      coldChainRequired: false,
      minTemp:           0,
      maxTemp:           3500,
      qrPayload:         "PCM-2024-001:MFG1:BATCH",
      ipfsCert:          "ipfs://QmGMP123certPCM"
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

  console.log("   ✅ Batch minted! Token ID:", tokenId.toString());
  console.log("   ✅ Medicine   : Panadol 500mg (Paracetamol)");
  console.log("   ✅ Batch No   : PCM-2024-001");
  console.log("   ✅ Quantity   : 50,000 units");
  console.log("   ⛽ Gas used   :", mintReceipt.gasUsed.toString());

  // ── STEP 2: Custody Manufacturer → SPC ───────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🚚 STEP 2: Custody transfer — Manufacturer → SPC...");

  await (await traceability.connect(mfg1).transferCustody(
    tokenId, spc.address,
    "Colombo Port Warehouse", 2500,
    "Transferred to SPC for national distribution",
    GAS
  )).wait();

  console.log("   ✅ Custody transferred to SPC");
  console.log("   ✅ Location : Colombo Port Warehouse");
  console.log("   ✅ Temp     : 25.00°C");

  // ── STEP 3: Pharmacy places order ────────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🏥 STEP 3: CareLife Pharmacy places order to SPC...");

  const orderTx = await ordering.connect(pharmacy).placeOrder(
    spc.address,
    "Panadol 500mg", "Paracetamol 500mg",
    10000, hre.ethers.parseEther("0.0001"),
    "Regular monthly procurement",
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
  console.log("   ✅ Item     : Panadol 500mg");
  console.log("   ✅ Quantity : 10,000 units");
  console.log("   ✅ Status   : AI_REVIEW");

  // ── STEP 4: AI Oracle sets risk = 0.300 ──────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🤖 STEP 4: AI Oracle evaluates order risk...");
  console.log("   Factors: stock levels OK, no shortage trend, routine item");

  await (await ordering.connect(nmra).setRiskScore(orderId, 300, GAS)).wait();

  console.log("   ✅ Risk Score : 0.300 (LOW)");
  console.log("   ✅ Path       : STANDARD (PoA approval)");
  console.log("   ✅ Status     : PENDING");

  // ── STEP 5: SPC approves ─────────────────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("✍️  STEP 5: SPC approves order via PoA consensus...");

  await (await ordering.connect(spc).approveOrder(orderId, GAS)).wait();

  console.log("   ✅ Order APPROVED by SPC");
  console.log("   ✅ Consensus : PoA (fast — routine order)");

  // ── STEP 6: SPC fulfills ─────────────────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("📬 STEP 6: SPC fulfills the order...");

  const fulfillReceipt = await (
    await ordering.connect(spc).fulfillOrder(orderId, GAS)
  ).wait();

  console.log("   ✅ Order FULFILLED by SPC");
  console.log("   ⛽ Gas used:", fulfillReceipt.gasUsed.toString());

  // ── STEP 7: Custody SPC → Pharmacy ───────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("🚛 STEP 7: Custody transfer — SPC → Pharmacy...");

  await (await traceability.connect(spc).transferCustody(
    tokenId, pharmacy.address,
    "CareLife Pharmacy, Colombo 03", 2400,
    "Delivered as per order #" + orderId.toString(),
    GAS
  )).wait();

  console.log("   ✅ Custody transferred to Pharmacy");
  console.log("   ✅ Location : CareLife Pharmacy, Colombo 03");

  // ── STEP 8: Patient QR verification ──────────────────────────────────────
  console.log("\n" + "-".repeat(70));
  console.log("📱 STEP 8: Patient scans QR code to verify...");

  const batch  = await traceability.getBatch(tokenId);
  const verifyReceipt = await (
    await traceability.connect(pharmacy).verifyByQR(batch.qrHash, GAS)
  ).wait();

  let isAuthentic = false;
  for (const log of verifyReceipt.logs) {
    try {
      const p = traceability.interface.parseLog(log);
      if (p.name === "QRVerified") { isAuthentic = p.args.isAuthentic; break; }
    } catch {}
  }

  console.log("   ✅ QR Verified!");
  console.log("   ✅ Is Authentic :", isAuthentic ? "true ✅" : "false ❌");
  const history    = await traceability.getCustodyHistory(tokenId);
  const finalOrder = await ordering.getOrder(orderId);

  const label = {
    [mfg1.address.toLowerCase()]:    "Manufacturer (MFG1)",
    [spc.address.toLowerCase()]:     "SPC",
    [pharmacy.address.toLowerCase()]: "CareLife Pharmacy"
  };

  console.log("\n" + "=".repeat(70));
  console.log("🎉 SCENARIO 1 COMPLETE — Full Supply Chain Traced!");
  console.log("=".repeat(70));

  console.log("\n📊 BATCH CUSTODY TRAIL (Token #" + tokenId.toString() + "):");
  for (let i = 0; i < history.length; i++) {
    const c  = history[i];
    const ts = new Date(Number(c.timestamp) * 1000).toLocaleString();
    const from = i === 0 ? "MINTED" : (label[c.from.toLowerCase()] || c.from.slice(0,10)+"...");
    const to   = label[c.to.toLowerCase()] || c.to.slice(0,10)+"...";
    console.log(`   Step ${i}: ${from} → ${to}`);
    console.log(`          📍 ${c.location}  🕐 ${ts}`);
  }

  console.log("\n📋 ORDER SUMMARY (Order #" + orderId.toString() + "):");
  console.log("   Medicine    :", finalOrder.medicineName);
  console.log("   Quantity    :", finalOrder.quantity.toString(), "units");
  console.log("   Risk Score  : 0.300 (LOW)");
  console.log("   Path        : STANDARD PoA");
  console.log("   Status      : FULFILLED ✅");
  console.log("   Approved by : SPC");
  
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  });