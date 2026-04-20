const { expect } = require("chai");
const hre = require("hardhat");

/**
 * test/05_Integration.test.js
 * ────────────────────────────
 * End-to-end integration tests for the complete Sri Lankan
 * pharmaceutical blockchain supply chain.
 *
 * Tests the FULL flow:
 *   NMRA deploys → grants roles → MFG mints batch →
 *   custody chain → pharmacy order → AI scores risk →
 *   PoA approval OR PBFT emergency → fulfillment → QR verify
 *
 * Run: npx hardhat test test/05_Integration.test.js
 */

const GAS = { gasLimit: 4000000 };

describe("Integration — Full Supply Chain", function () {
  let roleControl, traceability, ordering, oracle, consensus;
  let nmra, spc, msd, mfg1, importer, wholesaler, pharmacy, hospital, transporter;

  const EXPIRY = () => Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

  before(async function () {
    [nmra, spc, msd, mfg1, importer, wholesaler, pharmacy, hospital, transporter] =
      await hre.ethers.getSigners();

    // ── Deploy all 5 contracts ────────────────────────────────────────────
    const RACFactory = await hre.ethers.getContractFactory("RoleAccessControl");
    roleControl = await RACFactory.deploy("National Medicines Regulatory Authority", GAS);
    await roleControl.waitForDeployment();

    const TCFactory = await hre.ethers.getContractFactory("TraceabilityContract");
    traceability = await TCFactory.deploy(await roleControl.getAddress(), GAS);
    await traceability.waitForDeployment();

    const OCFactory = await hre.ethers.getContractFactory("OrderingContract");
    ordering = await OCFactory.deploy(await roleControl.getAddress(), nmra.address, GAS);
    await ordering.waitForDeployment();

    const OracleFactory = await hre.ethers.getContractFactory("PredictiveAIOracle");
    oracle = await OracleFactory.deploy(await roleControl.getAddress(), nmra.address, GAS);
    await oracle.waitForDeployment();

    const CAFactory = await hre.ethers.getContractFactory("ConsensusAdapter");
    consensus = await CAFactory.deploy(
      await roleControl.getAddress(),
      nmra.address, spc.address, msd.address, GAS
    );
    await consensus.waitForDeployment();

    // ── Grant all roles ───────────────────────────────────────────────────
    const grants = [
      { addr: spc.address,         role: "ROLE_SPC",          name: "State Pharmaceuticals Corporation" },
      { addr: msd.address,         role: "ROLE_MSD",          name: "Medical Supplies Division"         },
      { addr: mfg1.address,        role: "ROLE_MANUFACTURER", name: "Lanka Pharmaceuticals Ltd"         },
      { addr: importer.address,    role: "ROLE_IMPORTER",     name: "Global Meds Import Agency"         },
      { addr: wholesaler.address,  role: "ROLE_WHOLESALER",   name: "National Medical Wholesalers"      },
      { addr: pharmacy.address,    role: "ROLE_PHARMACY",     name: "CareLife Pharmacy"                 },
      { addr: hospital.address,    role: "ROLE_HOSPITAL",     name: "Colombo Teaching Hospital"         },
      { addr: transporter.address, role: "ROLE_TRANSPORTER",  name: "MediCold Transport"                },
    ];
    for (const g of grants) {
      await roleControl.connect(nmra).grantRole(
        g.addr, await roleControl[g.role](), g.name, 0, GAS
      );
    }

    // ── Issue licenses ────────────────────────────────────────────────────
    await roleControl.connect(nmra).issueLicense(mfg1.address, "NMRA/MFG/2024/001", 365, GAS);
  });

  // ════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Standard low-risk procurement (PoA path)
  // ════════════════════════════════════════════════════════════════════════
  describe("Scenario 1: Paracetamol — Standard PoA procurement", function () {
    let tokenId, orderId;

    it("Step 1: Manufacturer mints Paracetamol batch", async function () {
      const tx = await traceability.connect(mfg1).mintBatch({
        medicineName:      "Panadol 500mg",
        batchNumber:       "PCM-2024-INT-001",
        genericName:       "Paracetamol 500mg",
        quantity:          50000,
        expiryDate:        EXPIRY(),
        coldChainRequired: false,
        minTemp:           0,
        maxTemp:           3500,
        qrPayload:         "PCM-INT-001:TEST",
        ipfsCert:          "ipfs://QmTest"
      }, GAS);
      const receipt = await tx.wait();
      for (const log of receipt.logs) {
        try {
          const p = traceability.interface.parseLog(log);
          if (p.name === "BatchMinted") { tokenId = p.args.tokenId; break; }
        } catch {}
      }
      expect(tokenId).to.equal(1n);
    });

    it("Step 2: Custody transfer MFG → SPC", async function () {
      await traceability.connect(mfg1).transferCustody(
        tokenId, spc.address, "Colombo Port", 2500, "Delivery note", GAS
      );
      const batch = await traceability.getBatch(tokenId);
      expect(batch.currentHolder).to.equal(spc.address);
    });

    it("Step 3: AI Oracle records LOW risk prediction", async function () {
      await oracle.connect(nmra).submitPrediction(
        "paracetamol", 120, 45000, 50, 80, 150, GAS
      );
      const risk = await oracle.getRiskScore("paracetamol");
      expect(risk).to.equal(150n);
    });

    it("Step 4: Pharmacy places order to SPC", async function () {
      const tx = await ordering.connect(pharmacy).placeOrder(
        spc.address, "Panadol 500mg", "Paracetamol 500mg",
        10000, hre.ethers.parseEther("0.0001"),
        "Monthly replenishment", GAS
      );
      const receipt = await tx.wait();
      for (const log of receipt.logs) {
        try {
          const p = ordering.interface.parseLog(log);
          if (p.name === "OrderPlaced") { orderId = p.args.orderId; break; }
        } catch {}
      }
      expect(orderId).to.be.greaterThan(0n);
    });

    it("Step 5: AI sets LOW risk score → PoA (PENDING) path", async function () {
      await ordering.connect(nmra).setRiskScore(orderId, 150, GAS);
      const order = await ordering.getOrder(orderId);
      expect(Number(order.status)).to.equal(0);  // PENDING
      expect(Number(order.path)).to.equal(0);    // STANDARD
    });

    it("Step 6: SPC approves via PoA (no PBFT needed)", async function () {
      await ordering.connect(spc).approveOrder(orderId, GAS);
      const order = await ordering.getOrder(orderId);
      expect(Number(order.status)).to.equal(2);  // APPROVED
      expect(await consensus.isInPBFT()).to.be.false; // PoA unchanged
    });

    it("Step 7: Custody SPC → Pharmacy", async function () {
      await traceability.connect(spc).transferCustody(
        tokenId, pharmacy.address, "CareLife Pharmacy", 2400, "", GAS
      );
      const batch = await traceability.getBatch(tokenId);
      expect(batch.currentHolder).to.equal(pharmacy.address);
      expect(Number(batch.status)).to.equal(3); // AT_PHARMACY
    });

    it("Step 8: SPC fulfills order", async function () {
      await ordering.connect(spc).fulfillOrder(orderId, GAS);
      const order = await ordering.getOrder(orderId);
      expect(Number(order.status)).to.equal(4); // FULFILLED
    });

    it("Step 9: Patient verifies via QR", async function () {
      const batch = await traceability.getBatch(tokenId);
      const tx = await traceability.connect(pharmacy).verifyByQR(batch.qrHash, GAS);
      const receipt = await tx.wait();
      let isAuthentic = false;
      for (const log of receipt.logs) {
        try {
          const p = traceability.interface.parseLog(log);
          if (p.name === "QRVerified") { isAuthentic = p.args.isAuthentic; break; }
        } catch {}
      }
      expect(isAuthentic).to.be.true;
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Emergency high-risk procurement (PBFT path)
  // ════════════════════════════════════════════════════════════════════════
  describe("Scenario 2: Insulin — Emergency PBFT procurement", function () {
    let tokenId, orderId, eventId;
    const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("insulin-emergency"));

    it("Step 1: Manufacturer mints Insulin batch (cold chain)", async function () {
      const tx = await traceability.connect(mfg1).mintBatch({
        medicineName:      "Actrapid 100IU/mL",
        batchNumber:       "INS-2024-INT-001",
        genericName:       "Human Insulin",
        quantity:          5000,
        expiryDate:        EXPIRY(),
        coldChainRequired: true,
        minTemp:           200,
        maxTemp:           800,
        qrPayload:         "INS-INT-001:TEST",
        ipfsCert:          "ipfs://QmInsTest"
      }, GAS);
      const receipt = await tx.wait();
      for (const log of receipt.logs) {
        try {
          const p = traceability.interface.parseLog(log);
          if (p.name === "BatchMinted") { tokenId = p.args.tokenId; break; }
        } catch {}
      }
      expect(tokenId).to.be.greaterThan(0n);
    });

    it("Step 2: AI Oracle records CRITICAL risk for insulin", async function () {
      await oracle.connect(nmra).submitPrediction(
        "insulin", 820, 3200, 350, 120, 870, GAS
      );
      const risk = await oracle.getRiskScore("insulin");
      expect(risk).to.equal(870n);
    });

    it("Step 3: Hospital places URGENT order to MSD", async function () {
      const tx = await ordering.connect(hospital).placeOrder(
        msd.address, "Actrapid 100IU/mL", "Human Insulin",
        2000, hre.ethers.parseEther("0.001"),
        "URGENT: ICU insulin at 3-day level", GAS
      );
      const receipt = await tx.wait();
      for (const log of receipt.logs) {
        try {
          const p = ordering.interface.parseLog(log);
          if (p.name === "OrderPlaced") { orderId = p.args.orderId; break; }
        } catch {}
      }
      expect(orderId).to.be.greaterThan(0n);
    });

    it("Step 4: AI sets CRITICAL risk → EMERGENCY (PBFT) path", async function () {
      await ordering.connect(nmra).setRiskScore(orderId, 870, GAS);
      const order = await ordering.getOrder(orderId);
      expect(Number(order.status)).to.equal(3);  // EMERGENCY
      expect(Number(order.path)).to.equal(1);    // EMERGENCY path
    });

    it("Step 5: NMRA triggers PoA → PBFT switch", async function () {
      const tx = await consensus.connect(nmra).switchToPBFT(orderId, 870, 0, GAS);
      const receipt = await tx.wait();
      for (const log of receipt.logs) {
        try {
          const p = consensus.interface.parseLog(log);
          if (p.name === "ConsensusSwitched") { eventId = p.args.eventId; break; }
        } catch {}
      }
      expect(await consensus.isInPBFT()).to.be.true;
      expect(eventId).to.equal(1n);
    });

    it("Step 6: All 3 validators cast PBFT votes", async function () {
      await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(spc).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(msd).castVote(eventId, true, dataHash, GAS);
      expect(await consensus.getVoteCount(eventId)).to.equal(3n);
    });

    it("Step 7: NMRA approves emergency order (post-PBFT)", async function () {
      await ordering.connect(nmra).approveEmergencyOrder(orderId, GAS);
      const order = await ordering.getOrder(orderId);
      expect(Number(order.status)).to.equal(2); // APPROVED
    });

    it("Step 8: MSD fulfills emergency order (PRIORITY)", async function () {
      await ordering.connect(msd).fulfillOrder(orderId, GAS);
      const order = await ordering.getOrder(orderId);
      expect(Number(order.status)).to.equal(4); // FULFILLED
    });

    it("Step 9: Consensus restored to PoA", async function () {
      await consensus.connect(nmra).restorePoA(eventId, GAS);
      expect(await consensus.isInPBFT()).to.be.false;
      expect(await consensus.getCurrentMode()).to.equal(0n); // POA
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // FINAL STATISTICS
  // ════════════════════════════════════════════════════════════════════════
  describe("Final State Verification", function () {
    it("should have correct order statistics", async function () {
      const [total, fulfilled] = await ordering.getStats();
      expect(Number(total)).to.be.greaterThanOrEqual(2);
      expect(Number(fulfilled)).to.be.greaterThanOrEqual(2);
    });

    it("should have tracked 2 medicines in oracle", async function () {
      const tracked = await oracle.getTrackedMedicines();
      expect(tracked.length).to.be.greaterThanOrEqual(2);
    });

    it("should have 1 completed consensus switch", async function () {
      expect(await consensus.totalSwitches()).to.equal(1n);
    });

    it("should have correct total members (9 roles)", async function () {
      expect(await roleControl.totalMembers()).to.equal(9n);
    });
  });
});