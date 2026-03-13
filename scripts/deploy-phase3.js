const hre = require("hardhat");
const fs  = require("fs");

/**
 * deploy-phase3.js
 * ─────────────────
 * Deploys Phase 3 contracts:
 *   1. PredictiveAIOracle  (receives LSTM predictions)
 *   2. ConsensusAdapter    (records PoA ↔ PBFT switching)
 *
 * Requires Phase 2 contracts already deployed (reads deployment-phase2.json)
 */

const GAS = { gasLimit: 4000000 };

async function main() {
  const SEP = "=".repeat(70);
  console.log("\n" + SEP);
  console.log("🚀  PHASE 3 DEPLOYMENT — AI Oracle + Consensus Adapter");
  console.log(SEP);

  // ── Load Phase 2 deployment ──────────────────────────────────────────────
  let phase2;
  try {
    phase2 = JSON.parse(fs.readFileSync("deployment-phase2.json"));
  } catch {
    console.error("❌ deployment-phase2.json not found!");
    console.error("   Run Phase 2 deployment first.");
    process.exit(1);
  }

  const roleControlAddr = phase2.contracts.RoleAccessControl;
  console.log("\n📋 Using Phase 2 RoleAccessControl:", roleControlAddr);

  // ── Get signers ───────────────────────────────────────────────────────────
  const [nmra, spc, msd] = await hre.ethers.getSigners();
  console.log("\n📋 Validators:");
  console.log("   NMRA :", nmra.address);
  console.log("   SPC  :", spc.address);
  console.log("   MSD  :", msd.address);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. DEPLOY PredictiveAIOracle
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("1️⃣  Deploying PredictiveAIOracle...");

  const OracleFactory = await hre.ethers.getContractFactory("PredictiveAIOracle");
  const oracle        = await OracleFactory.deploy(roleControlAddr, nmra.address, GAS);
  await oracle.waitForDeployment();
  const oracleAddr    = await oracle.getAddress();
  console.log("   ✅ PredictiveAIOracle deployed at:", oracleAddr);
  console.log("   ✅ Oracle operator set to NMRA   :", nmra.address);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. DEPLOY ConsensusAdapter
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEP);
  console.log("2️⃣  Deploying ConsensusAdapter...");

  const ConsensusFactory = await hre.ethers.getContractFactory("ConsensusAdapter");
  const consensus        = await ConsensusFactory.deploy(
    roleControlAddr, nmra.address, spc.address, msd.address, GAS
  );
  await consensus.waitForDeployment();
  const consensusAddr = await consensus.getAddress();
  console.log("   ✅ ConsensusAdapter deployed at:", consensusAddr);
  console.log("   ✅ Validators: NMRA, SPC, MSD");

  // ── Verify initial state ──────────────────────────────────────────────────
  const mode = await consensus.getCurrentMode();
  console.log("   ✅ Initial consensus mode: PoA (mode =", mode.toString(), ")");

  // ── Save deployment info ──────────────────────────────────────────────────
  const network = await hre.ethers.provider.getNetwork();
  const block   = await hre.ethers.provider.getBlockNumber();

  const info = {
    network:         hre.network.name,
    chainId:         network.chainId.toString(),
    deploymentBlock: block,
    deploymentTime:  new Date().toISOString(),
    contracts: {
      // Phase 2 (carried forward)
      RoleAccessControl:    roleControlAddr,
      TraceabilityContract: phase2.contracts.TraceabilityContract,
      OrderingContract:     phase2.contracts.OrderingContract,
      // Phase 3 (new)
      PredictiveAIOracle:   oracleAddr,
      ConsensusAdapter:     consensusAddr,
    },
    accounts: phase2.accounts,
    oracleOperator: nmra.address,
    validators: {
      NMRA: nmra.address,
      SPC:  spc.address,
      MSD:  msd.address,
    }
  };

  fs.writeFileSync("deployment-phase3.json", JSON.stringify(info, null, 2));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + SEP);
  console.log("🎉  PHASE 3 DEPLOYMENT COMPLETE!");
  console.log(SEP);
  console.log("\n📍 All Contract Addresses:");
  console.log("   RoleAccessControl    :", roleControlAddr);
  console.log("   TraceabilityContract :", phase2.contracts.TraceabilityContract);
  console.log("   OrderingContract     :", phase2.contracts.OrderingContract);
  console.log("   PredictiveAIOracle   :", oracleAddr);
  console.log("   ConsensusAdapter     :", consensusAddr);
  console.log("\n💾 Saved to: deployment-phase3.json");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });