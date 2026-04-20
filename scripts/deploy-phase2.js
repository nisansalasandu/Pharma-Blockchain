const hre = require("hardhat");
const fs  = require("fs");

// viaIR compiled contracts need explicit gas limit
const GAS = { gasLimit: 4000000 };

/**
 * deploy-phase2.js
 * ─────────────────
 * Deploys all three Phase 2 contracts in order:
 *   1. RoleAccessControl  (no dependencies)
 *   2. TraceabilityContract (needs RoleAccessControl address)
 *   3. OrderingContract     (needs RoleAccessControl + AI Oracle address)
 *
 * Then grants roles to all 10 Ganache accounts:
 *   Account 0 → NMRA  (auto-granted in constructor)
 *   Account 1 → SPC
 *   Account 2 → MSD
 *   Account 3 → MANUFACTURER
 *   Account 4 → MANUFACTURER
 *   Account 5 → IMPORTER
 *   Account 6 → WHOLESALER
 *   Account 7 → PHARMACY
 *   Account 8 → HOSPITAL
 *   Account 9 → TRANSPORTER
 */
async function main() {
  const SEPARATOR = "=".repeat(70);
  console.log("\n" + SEPARATOR);
  console.log("🚀  PHASE 2 DEPLOYMENT — Sri Lanka PharmaChain");
  console.log(SEPARATOR);

  // ── Get all 10 signers ──────────────────────────────────────────────────
  const [
    nmra, spc, msd, mfg1, mfg2,
    importer, wholesaler, pharmacy, hospital, transporter
  ] = await hre.ethers.getSigners();

  console.log("\n📋 Signer addresses:");
  console.log("  Account 0 (NMRA)        :", nmra.address);
  console.log("  Account 1 (SPC)         :", spc.address);
  console.log("  Account 2 (MSD)         :", msd.address);
  console.log("  Account 3 (Manufacturer1):", mfg1.address);
  console.log("  Account 4 (Manufacturer2):", mfg2.address);
  console.log("  Account 5 (Importer)    :", importer.address);
  console.log("  Account 6 (Wholesaler)  :", wholesaler.address);
  console.log("  Account 7 (Pharmacy)    :", pharmacy.address);
  console.log("  Account 8 (Hospital)    :", hospital.address);
  console.log("  Account 9 (Transporter) :", transporter.address);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. DEPLOY RoleAccessControl
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEPARATOR);
  console.log("1️⃣  Deploying RoleAccessControl...");

  const RoleAccessControl = await hre.ethers.getContractFactory("RoleAccessControl");
  const roleControl = await RoleAccessControl.deploy(
    "National Medicines Regulatory Authority"
  );
  await roleControl.waitForDeployment();
  const roleControlAddr = await roleControl.getAddress();

  console.log("   ✅ RoleAccessControl deployed at:", roleControlAddr);
  console.log("   ✅ NMRA (Account 0) auto-registered as deployer");

  // ── Grant roles to Accounts 1–9 ─────────────────────────────────────────
  console.log("\n   Granting roles to all 10 accounts...\n");

  const roleGrants = [
    { signer: spc,         role: "ROLE_SPC",          name: "State Pharmaceuticals Corporation",   expiry: 0 },
    { signer: msd,         role: "ROLE_MSD",          name: "Medical Supplies Division",            expiry: 0 },
    { signer: mfg1,        role: "ROLE_MANUFACTURER", name: "Lanka Pharmaceuticals Ltd",            expiry: 0 },
    { signer: mfg2,        role: "ROLE_MANUFACTURER", name: "Ceylon Pharma Industries",             expiry: 0 },
    { signer: importer,    role: "ROLE_IMPORTER",     name: "Global Meds Import Agency",            expiry: 0 },
    { signer: wholesaler,  role: "ROLE_WHOLESALER",   name: "National Medical Wholesalers",         expiry: 0 },
    { signer: pharmacy,    role: "ROLE_PHARMACY",     name: "CareLife Pharmacy Chain",              expiry: 0 },
    { signer: hospital,    role: "ROLE_HOSPITAL",     name: "Colombo Teaching Hospital Pharmacy",   expiry: 0 },
    { signer: transporter, role: "ROLE_TRANSPORTER",  name: "MediCold Transport Solutions",         expiry: 0 },
  ];

  for (const g of roleGrants) {
    const tx = await roleControl.connect(nmra).grantRole(
      g.signer.address,
      await roleControl[g.role](),
      g.name,
      g.expiry,
      GAS
    );
    await tx.wait();
    console.log(`   ✅ ${g.name}`);
    console.log(`      Address: ${g.signer.address}`);
    console.log(`      Role   : ${g.role}\n`);
  }

  const total = await roleControl.totalMembers();
  console.log(`   📊 Total registered members: ${total}`);

  // ── Issue NMRA licence to manufacturers ──────────────────────────────────
  console.log("\n   Issuing NMRA licences...\n");

  const licences = [
    { holder: mfg1.address,     number: "NMRA/MFG/2024/001", days: 365 },
    { holder: mfg2.address,     number: "NMRA/MFG/2024/002", days: 365 },
    { holder: importer.address, number: "NMRA/IMP/2024/001", days: 365 },
  ];

  for (const lic of licences) {
    const tx = await roleControl.connect(nmra).issueLicense(lic.holder, lic.number, lic.days, GAS);
    await tx.wait();
    console.log(`   ✅ Licence ${lic.number} issued to ${lic.holder}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. DEPLOY TraceabilityContract
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEPARATOR);
  console.log("2️⃣  Deploying TraceabilityContract...");

  const TraceabilityContract = await hre.ethers.getContractFactory("TraceabilityContract");
  const traceability = await TraceabilityContract.deploy(roleControlAddr);
  await traceability.waitForDeployment();
  const traceabilityAddr = await traceability.getAddress();

  console.log("   ✅ TraceabilityContract deployed at:", traceabilityAddr);

  // ══════════════════════════════════════════════════════════════════════════
  // 3. DEPLOY OrderingContract
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEPARATOR);
  console.log("3️⃣  Deploying OrderingContract...");

  // For demo: NMRA address acts as AI oracle
  const aiOracleDemo = nmra.address;

  const OrderingContract = await hre.ethers.getContractFactory("OrderingContract");
  const ordering = await OrderingContract.deploy(roleControlAddr, aiOracleDemo);
  await ordering.waitForDeployment();
  const orderingAddr = await ordering.getAddress();

  console.log("   ✅ OrderingContract deployed at :", orderingAddr);
  console.log("   ✅ AI Oracle (demo)             :", aiOracleDemo, "(NMRA)");

  // ══════════════════════════════════════════════════════════════════════════
  // SAVE DEPLOYMENT INFO
  // ══════════════════════════════════════════════════════════════════════════
  const network = await hre.ethers.provider.getNetwork();
  const block   = await hre.ethers.provider.getBlockNumber();

  const deploymentInfo = {
    network:           hre.network.name,
    chainId:           network.chainId.toString(),
    deploymentBlock:   block,
    deploymentTime:    new Date().toISOString(),
    contracts: {
      RoleAccessControl:    roleControlAddr,
      TraceabilityContract: traceabilityAddr,
      OrderingContract:     orderingAddr,
    },
    accounts: {
      NMRA:        nmra.address,
      SPC:         spc.address,
      MSD:         msd.address,
      Manufacturer1: mfg1.address,
      Manufacturer2: mfg2.address,
      Importer:    importer.address,
      Wholesaler:  wholesaler.address,
      Pharmacy:    pharmacy.address,
      Hospital:    hospital.address,
      Transporter: transporter.address,
    }
  };

  fs.writeFileSync("deployment-phase2.json", JSON.stringify(deploymentInfo, null, 2));

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + SEPARATOR);
  console.log("🎉  ALL PHASE 2 CONTRACTS DEPLOYED SUCCESSFULLY!");
  console.log(SEPARATOR);
  console.log("\n📍 Contract Addresses:");
  console.log("   RoleAccessControl    :", roleControlAddr);
  console.log("   TraceabilityContract :", traceabilityAddr);
  console.log("   OrderingContract     :", orderingAddr);
  console.log("\n💾 Saved to: deployment-phase2.json");
  console.log("\n📝 Next step:");
  console.log("   npx hardhat run scripts/demo-scenario1.js --network ganache");
  console.log("   npx hardhat run scripts/demo-scenario2.js --network ganache\n");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });