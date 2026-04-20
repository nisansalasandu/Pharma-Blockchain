const hre = require("hardhat");
const fs  = require("fs");

/**
 * scripts/benchmark.js
 * ─────────────────────
 * Performance benchmarks for all 5 contracts.
 * Measures: transaction times, gas consumption, throughput.
 *
 * Outputs results to benchmark-results.json for thesis Chapter 4.
 *
 * Run: npx hardhat run scripts/benchmark.js --network ganache
 */

const GAS = { gasLimit: 4000000 };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function measureTx(label, txPromise) {
  const start   = Date.now();
  const tx      = await txPromise;
  const receipt = await tx.wait();
  const elapsed = Date.now() - start;
  const gasUsed = Number(receipt.gasUsed);
  return { label, elapsed, gasUsed, txHash: receipt.hash };
}

async function main() {
  const SEP = "=".repeat(65);
  console.log("\n" + SEP);
  console.log("⚡ PHARMACHAIN PERFORMANCE BENCHMARK");
  console.log(SEP);

  const [nmra, spc, msd, mfg1, , , , pharmacy, hospital] =
    await hre.ethers.getSigners();

  // ── Deploy all contracts ──────────────────────────────────────────────
  console.log("\n📦 Deploying contracts for benchmarking...");

  const deployStart = Date.now();

  const RACFactory = await hre.ethers.getContractFactory("RoleAccessControl");
  const roleControl = await RACFactory.deploy("NMRA", GAS);
  await roleControl.waitForDeployment();

  const TCFactory = await hre.ethers.getContractFactory("TraceabilityContract");
  const traceability = await TCFactory.deploy(await roleControl.getAddress(), GAS);
  await traceability.waitForDeployment();

  const OCFactory = await hre.ethers.getContractFactory("OrderingContract");
  const ordering = await OCFactory.deploy(await roleControl.getAddress(), nmra.address, GAS);
  await ordering.waitForDeployment();

  const OracleFactory = await hre.ethers.getContractFactory("PredictiveAIOracle");
  const oracle = await OracleFactory.deploy(await roleControl.getAddress(), nmra.address, GAS);
  await oracle.waitForDeployment();

  const CAFactory = await hre.ethers.getContractFactory("ConsensusAdapter");
  const consensus = await CAFactory.deploy(
    await roleControl.getAddress(), nmra.address, spc.address, msd.address, GAS
  );
  await consensus.waitForDeployment();

  const deployTime = Date.now() - deployStart;
  console.log(`   ✅ All 5 contracts deployed in ${deployTime}ms`);

  // ── Setup roles ──────────────────────────────────────────────────────
  const grants = [
    { addr: spc.address,      role: "ROLE_SPC",          name: "SPC"      },
    { addr: msd.address,      role: "ROLE_MSD",          name: "MSD"      },
    { addr: mfg1.address,     role: "ROLE_MANUFACTURER", name: "MFG"      },
    { addr: pharmacy.address, role: "ROLE_PHARMACY",     name: "PHARMACY" },
    { addr: hospital.address, role: "ROLE_HOSPITAL",     name: "HOSPITAL" },
  ];
  for (const g of grants) {
    await roleControl.connect(nmra).grantRole(
      g.addr, await roleControl[g.role](), g.name, 0, GAS
    );
  }

  const EXPIRY = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const results = { deployTimeMs: deployTime, benchmarks: [] };

  // ════════════════════════════════════════════════════════════════════
  // BENCHMARK 1: Role Granting
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📊 BENCHMARK 1: Role Management");
  console.log(SEP);

  const allSigners = await hre.ethers.getSigners();
  const unusedAccounts = [4, 5, 6, 9]; // These are not used in initial setup

  // Grant 4 fresh addresses
  const grantTimes = [];
  for (let i = 0; i < unusedAccounts.length; i++) {
    const accountIndex = unusedAccounts[i];
    const result = await measureTx(
      `grantRole #${i+1}`,
      roleControl.connect(nmra).grantRole(
        allSigners[accountIndex].address,
        await roleControl.ROLE_WHOLESALER(),
        `Test Wholesaler ${i+1}`, 0, GAS
      )
    );
    grantTimes.push(result);
    console.log(`   grantRole #${i+1}: ${result.elapsed}ms | gas: ${result.gasUsed.toLocaleString()}`);
  }

  const avgGrantTime = Math.round(grantTimes.reduce((s, r) => s + r.elapsed, 0) / grantTimes.length);
  const avgGrantGas  = Math.round(grantTimes.reduce((s, r) => s + r.gasUsed, 0) / grantTimes.length);
  console.log(`\n   📈 Average: ${avgGrantTime}ms | avg gas: ${avgGrantGas.toLocaleString()}`);
  results.benchmarks.push({ name: "grantRole", avgMs: avgGrantTime, avgGas: avgGrantGas, samples: 4 });

  // ════════════════════════════════════════════════════════════════════
  // BENCHMARK 2: Batch Minting
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📊 BENCHMARK 2: Batch Minting (TraceabilityContract)");
  console.log(SEP);

  const mintTimes = [];
  for (let i = 0; i < 5; i++) {
    const result = await measureTx(
      `mintBatch #${i+1}`,
      traceability.connect(mfg1).mintBatch({
        medicineName: `Medicine ${i+1}`, batchNumber: `BATCH-00${i+1}`,
        genericName:  `Generic ${i+1}`,  quantity:    10000 + i * 1000,
        expiryDate:   EXPIRY,            coldChainRequired: false, // Disable cold-chain for benchmarking
        minTemp:      0,                 maxTemp:     3500,
        qrPayload:    `QR-BENCH-${i+1}`, ipfsCert:   `ipfs://QmBench${i}`
      }, GAS)
    );
    mintTimes.push(result);
    console.log(`   mintBatch #${i+1}: ${result.elapsed}ms | gas: ${result.gasUsed.toLocaleString()}`);
  }

  const avgMintTime = Math.round(mintTimes.reduce((s, r) => s + r.elapsed, 0) / mintTimes.length);
  const avgMintGas  = Math.round(mintTimes.reduce((s, r) => s + r.gasUsed, 0) / mintTimes.length);
  console.log(`\n   📈 Average: ${avgMintTime}ms | avg gas: ${avgMintGas.toLocaleString()}`);
  results.benchmarks.push({ name: "mintBatch", avgMs: avgMintTime, avgGas: avgMintGas, samples: 5 });

  // ════════════════════════════════════════════════════════════════════
  // BENCHMARK 3: Custody Transfer
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📊 BENCHMARK 3: Custody Transfer");
  console.log(SEP);

  const transferTimes = [];
  for (let i = 1; i <= 5; i++) {
    const result = await measureTx(
      `transferCustody #${i}`,
      traceability.connect(mfg1).transferCustody(
        i, spc.address, `Location ${i}`, 2500, `Transfer note ${i}`, GAS
      )
    );
    transferTimes.push(result);
    console.log(`   transferCustody #${i}: ${result.elapsed}ms | gas: ${result.gasUsed.toLocaleString()}`);
  }

  const avgTransferTime = Math.round(transferTimes.reduce((s, r) => s + r.elapsed, 0) / transferTimes.length);
  const avgTransferGas  = Math.round(transferTimes.reduce((s, r) => s + r.gasUsed, 0) / transferTimes.length);
  console.log(`\n   📈 Average: ${avgTransferTime}ms | avg gas: ${avgTransferGas.toLocaleString()}`);
  results.benchmarks.push({ name: "transferCustody", avgMs: avgTransferTime, avgGas: avgTransferGas, samples: 5 });

  // ════════════════════════════════════════════════════════════════════
  // BENCHMARK 4: Order Placement
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📊 BENCHMARK 4: Order Placement (OrderingContract)");
  console.log(SEP);

  const orderTimes = [];
  for (let i = 0; i < 5; i++) {
    const result = await measureTx(
      `placeOrder #${i+1}`,
      ordering.connect(pharmacy).placeOrder(
        spc.address, `Medicine ${i}`, `Generic ${i}`,
        1000 + i * 500, 0n, `Order reason ${i}`, GAS
      )
    );
    orderTimes.push(result);
    console.log(`   placeOrder #${i+1}: ${result.elapsed}ms | gas: ${result.gasUsed.toLocaleString()}`);
  }

  const avgOrderTime = Math.round(orderTimes.reduce((s, r) => s + r.elapsed, 0) / orderTimes.length);
  const avgOrderGas  = Math.round(orderTimes.reduce((s, r) => s + r.gasUsed, 0) / orderTimes.length);
  console.log(`\n   📈 Average: ${avgOrderTime}ms | avg gas: ${avgOrderGas.toLocaleString()}`);
  results.benchmarks.push({ name: "placeOrder", avgMs: avgOrderTime, avgGas: avgOrderGas, samples: 5 });

  // ════════════════════════════════════════════════════════════════════
  // BENCHMARK 5: AI Oracle Prediction Submission
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📊 BENCHMARK 5: AI Oracle Prediction Submission");
  console.log(SEP);

  const medicines = ["paracetamol", "amoxicillin", "metformin", "insulin", "amlodipine"];
  const oracleTimes = [];
  for (const med of medicines) {
    const result = await measureTx(
      `submitPrediction(${med})`,
      oracle.connect(nmra).submitPrediction(
        med,
        Math.floor(Math.random() * 900),
        Math.floor(Math.random() * 50000),
        Math.floor(Math.random() * 400),
        Math.floor(Math.random() * 200),
        Math.floor(Math.random() * 800),
        GAS
      )
    );
    oracleTimes.push(result);
    console.log(`   submitPrediction(${med.padEnd(14)}): ${result.elapsed}ms | gas: ${result.gasUsed.toLocaleString()}`);
  }

  const avgOracleTime = Math.round(oracleTimes.reduce((s, r) => s + r.elapsed, 0) / oracleTimes.length);
  const avgOracleGas  = Math.round(oracleTimes.reduce((s, r) => s + r.gasUsed, 0) / oracleTimes.length);
  console.log(`\n   📈 Average: ${avgOracleTime}ms | avg gas: ${avgOracleGas.toLocaleString()}`);
  results.benchmarks.push({ name: "submitPrediction", avgMs: avgOracleTime, avgGas: avgOracleGas, samples: 5 });

  // ════════════════════════════════════════════════════════════════════
  // BENCHMARK 6: PBFT Consensus Round (full cycle)
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📊 BENCHMARK 6: PBFT Consensus Round (full cycle)");
  console.log(SEP);

  const pbftTimes = [];
  const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("benchmark-pbft"));

  for (let i = 0; i < 3; i++) {
    const cycleStart = Date.now();

    const switchTx = await consensus.connect(nmra).switchToPBFT(i + 1, 870, 0, GAS);
    const switchReceipt = await switchTx.wait();
    let eventId;
    for (const log of switchReceipt.logs) {
      try {
        const p = consensus.interface.parseLog(log);
        if (p.name === "ConsensusSwitched") { eventId = p.args.eventId; break; }
      } catch {}
    }

    await (await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS)).wait();
    await (await consensus.connect(spc).castVote(eventId, true, dataHash, GAS)).wait();
    await (await consensus.connect(msd).castVote(eventId, true, dataHash, GAS)).wait();
    await (await consensus.connect(nmra).restorePoA(eventId, GAS)).wait();

    const cycleTime = Date.now() - cycleStart;
    pbftTimes.push(cycleTime);
    console.log(`   PBFT cycle #${i+1}: ${cycleTime}ms (switch + 3 votes + restore)`);
  }

  const avgPBFTTime = Math.round(pbftTimes.reduce((s, t) => s + t, 0) / pbftTimes.length);
  console.log(`\n   📈 Average full PBFT cycle: ${avgPBFTTime}ms`);
  results.benchmarks.push({ name: "pbftFullCycle", avgMs: avgPBFTTime, avgGas: "N/A (multi-tx)", samples: 3 });

  // ════════════════════════════════════════════════════════════════════
  // THROUGHPUT TEST
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📊 THROUGHPUT: Orders per minute estimate");
  console.log(SEP);

  const tpStart = Date.now();
  const tpCount = 10;
  for (let i = 0; i < tpCount; i++) {
    await (await ordering.connect(pharmacy).placeOrder(
      spc.address, `TP Med ${i}`, `TP Generic ${i}`, 100, 0n, "", GAS
    )).wait();
  }
  const tpElapsed = Date.now() - tpStart;
  const tpPerMin  = Math.round((tpCount / tpElapsed) * 60000);

  console.log(`   ${tpCount} orders in ${tpElapsed}ms`);
  console.log(`   📈 Estimated throughput: ~${tpPerMin} orders/minute`);
  results.throughput = { ordersPerMinute: tpPerMin, sampleSize: tpCount, elapsedMs: tpElapsed };

  // ════════════════════════════════════════════════════════════════════
  // SUMMARY TABLE
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("📋 BENCHMARK SUMMARY");
  console.log(SEP);
  console.log("\n  Operation              Avg Time    Avg Gas");
  console.log("  " + "-".repeat(50));
  for (const b of results.benchmarks) {
    const gas = typeof b.avgGas === "number" ? b.avgGas.toLocaleString().padStart(12) : b.avgGas.padStart(12);
    console.log(`  ${b.name.padEnd(22)} ${String(b.avgMs + "ms").padStart(8)}  ${gas}`);
  }
  console.log(`\n  Throughput: ~${results.throughput.ordersPerMinute} orders/minute`);
  console.log(`  Deploy time: ${results.deployTimeMs}ms (all 5 contracts)`);

  // ── Save to JSON for thesis ───────────────────────────────────────────
  results.timestamp = new Date().toISOString();
  results.network   = hre.network.name;
  fs.writeFileSync("benchmark-results.json", JSON.stringify(results, null, 2));
  console.log("\n💾 Results saved to benchmark-results.json\n");

}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Benchmark error:", err.message);
    process.exit(1);
  });