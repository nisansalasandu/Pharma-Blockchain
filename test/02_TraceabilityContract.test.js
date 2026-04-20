const { expect } = require("chai");
const hre = require("hardhat");

/**
 * test/02_TraceabilityContract.test.js
 * ──────────────────────────────────────
 * Unit tests for TraceabilityContract.
 * Tests: batch minting, custody transfer, cold-chain, QR verification, recall.
 *
 * Run: npx hardhat test test/02_TraceabilityContract.test.js
 */

const GAS = { gasLimit: 4000000 };

describe("TraceabilityContract", function () {
  let roleControl, traceability;
  let nmra, spc, msd, mfg1, importer, wholesaler, pharmacy, hospital, transporter;

  const EXPIRY_DATE = () => Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  // Standard batch params for Paracetamol (no cold chain)
  const paracetamolParams = () => ({
    medicineName:      "Panadol 500mg",
    batchNumber:       "PCM-2024-001",
    genericName:       "Paracetamol 500mg",
    quantity:          50000,
    expiryDate:        EXPIRY_DATE(),
    coldChainRequired: false,
    minTemp:           0,
    maxTemp:           3500,
    qrPayload:         "PCM-2024-001:MFG1:TEST",
    ipfsCert:          "ipfs://QmTest123"
  });

  // Cold-chain batch params for Insulin
  const insulinParams = () => ({
    medicineName:      "Actrapid 100IU/mL",
    batchNumber:       "INS-2024-001",
    genericName:       "Human Insulin",
    quantity:          5000,
    expiryDate:        EXPIRY_DATE(),
    coldChainRequired: true,
    minTemp:           200,   // 2.00°C
    maxTemp:           800,   // 8.00°C
    qrPayload:         "INS-2024-001:MFG1:TEST",
    ipfsCert:          "ipfs://QmInsTest"
  });

  beforeEach(async function () {
    [nmra, spc, msd, mfg1, importer, wholesaler, pharmacy, hospital, transporter] =
      await hre.ethers.getSigners();

    // Deploy RoleAccessControl
    const RACFactory = await hre.ethers.getContractFactory("RoleAccessControl");
    roleControl = await RACFactory.deploy("NMRA", GAS);
    await roleControl.waitForDeployment();

    // Grant roles
    const grants = [
      { addr: spc.address,         role: "ROLE_SPC",          name: "SPC"         },
      { addr: msd.address,         role: "ROLE_MSD",          name: "MSD"         },
      { addr: mfg1.address,        role: "ROLE_MANUFACTURER", name: "MFG1"        },
      { addr: importer.address,    role: "ROLE_IMPORTER",     name: "IMPORTER"    },
      { addr: wholesaler.address,  role: "ROLE_WHOLESALER",   name: "WHOLESALER"  },
      { addr: pharmacy.address,    role: "ROLE_PHARMACY",     name: "PHARMACY"    },
      { addr: hospital.address,    role: "ROLE_HOSPITAL",     name: "HOSPITAL"    },
      { addr: transporter.address, role: "ROLE_TRANSPORTER",  name: "TRANSPORTER" },
    ];
    for (const g of grants) {
      await roleControl.connect(nmra).grantRole(
        g.addr, await roleControl[g.role](), g.name, 0, GAS
      );
    }

    // Deploy TraceabilityContract
    const TCFactory = await hre.ethers.getContractFactory("TraceabilityContract");
    traceability = await TCFactory.deploy(await roleControl.getAddress(), GAS);
    await traceability.waitForDeployment();
  });

  // ════════════════════════════════════════════════════════════════════════
  // MINTING TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("mintBatch", function () {
    it("should mint batch and return tokenId = 1", async function () {
      const tx = await traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS);
      const receipt = await tx.wait();
      let tokenId;
      for (const log of receipt.logs) {
        try {
          const p = traceability.interface.parseLog(log);
          if (p.name === "BatchMinted") { tokenId = p.args.tokenId; break; }
        } catch {}
      }
      expect(tokenId).to.equal(1n);
    });

    it("should store correct batch details", async function () {
      await traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS);
      const batch = await traceability.getBatch(1);
      expect(batch.medicineName).to.equal("Panadol 500mg");
      expect(batch.quantity).to.equal(50000n);
      expect(batch.manufacturer).to.equal(mfg1.address);
      expect(batch.currentHolder).to.equal(mfg1.address);
      expect(batch.coldChainRequired).to.be.false;
      expect(batch.isRecalled).to.be.false;
    });

    it("should increment totalBatches", async function () {
      await traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS);
      await traceability.connect(mfg1).mintBatch(insulinParams(), GAS);
      expect(await traceability.totalBatches()).to.equal(2n);
    });

    it("should store correct cold chain parameters for insulin", async function () {
      await traceability.connect(mfg1).mintBatch(insulinParams(), GAS);
      const batch = await traceability.getBatch(1);
      expect(batch.coldChainRequired).to.be.true;
      expect(batch.minTemp).to.equal(200n);
      expect(batch.maxTemp).to.equal(800n);
    });

    it("should revert if non-manufacturer tries to mint", async function () {
      await expect(
        traceability.connect(pharmacy).mintBatch(paracetamolParams(), GAS)
      ).to.be.revertedWith("TC: must be MANUFACTURER or IMPORTER");
    });

    it("should revert if quantity is zero", async function () {
      const params = { ...paracetamolParams(), quantity: 0 };
      await expect(
        traceability.connect(mfg1).mintBatch(params, GAS)
      ).to.be.revertedWith("TC: zero quantity");
    });

    it("should revert if expiry date is in the past", async function () {
      const params = { ...paracetamolParams(), expiryDate: 1000 };
      await expect(
        traceability.connect(mfg1).mintBatch(params, GAS)
      ).to.be.revertedWith("TC: expiry in past");
    });

    it("should create initial custody record", async function () {
      await traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS);
      const history = await traceability.getCustodyHistory(1);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(hre.ethers.ZeroAddress);
      expect(history[0].to).to.equal(mfg1.address);
      expect(history[0].location).to.equal("Manufacturing Facility");
    });

    it("should emit BatchMinted event", async function () {
      await expect(
        traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS)
      ).to.emit(traceability, "BatchMinted")
       .withArgs(1n, "PCM-2024-001", "Panadol 500mg", mfg1.address, 50000n);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // CUSTODY TRANSFER TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("transferCustody", function () {
    beforeEach(async function () {
      await traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS);
    });

    it("should transfer custody from manufacturer to SPC", async function () {
      await traceability.connect(mfg1).transferCustody(
        1, spc.address, "Colombo Port", 2500, "Delivery note", GAS
      );
      const batch = await traceability.getBatch(1);
      expect(batch.currentHolder).to.equal(spc.address);
    });

    it("should add custody record to history", async function () {
      await traceability.connect(mfg1).transferCustody(
        1, spc.address, "Colombo Port", 2500, "Test", GAS
      );
      const history = await traceability.getCustodyHistory(1);
      expect(history.length).to.equal(2);
      expect(history[1].from).to.equal(mfg1.address);
      expect(history[1].to).to.equal(spc.address);
      expect(history[1].location).to.equal("Colombo Port");
    });

    it("should update batch status to AT_WAREHOUSE when transferred to SPC", async function () {
      await traceability.connect(mfg1).transferCustody(
        1, spc.address, "Colombo", 2500, "", GAS
      );
      const batch = await traceability.getBatch(1);
      expect(Number(batch.status)).to.equal(2); // AT_WAREHOUSE
    });

    it("should update batch status to AT_PHARMACY when transferred to pharmacy", async function () {
      await traceability.connect(mfg1).transferCustody(
        1, spc.address, "Colombo", 2500, "", GAS
      );
      await traceability.connect(spc).transferCustody(
        1, pharmacy.address, "Pharmacy", 2400, "", GAS
      );
      const batch = await traceability.getBatch(1);
      expect(Number(batch.status)).to.equal(3); // AT_PHARMACY
    });

    it("should revert if non-holder tries to transfer", async function () {
      await expect(
        traceability.connect(spc).transferCustody(
          1, pharmacy.address, "Anywhere", 2500, "", GAS
        )
      ).to.be.revertedWith("TC: not current holder");
    });

    it("should revert self-transfer", async function () {
      await expect(
        traceability.connect(mfg1).transferCustody(
          1, mfg1.address, "Self", 2500, "", GAS
        )
      ).to.be.revertedWith("TC: self-transfer");
    });

    it("should emit CustodyTransferred event", async function () {
      const tx = await traceability.connect(mfg1).transferCustody(
        1, spc.address, "Colombo Port", 2500, "Test", GAS
      );
      const receipt = await tx.wait();
      
      // Verify event was emitted
      let found = false;
      for (const log of receipt.logs) {
        try {
          const parsed = traceability.interface.parseLog(log);
          if (parsed.name === "CustodyTransferred") {
            expect(parsed.args.tokenId).to.equal(1n);
            expect(parsed.args.from).to.equal(mfg1.address);
            expect(parsed.args.to).to.equal(spc.address);
            expect(parsed.args.location).to.equal("Colombo Port");
            // timestamp is dynamic, just check it exists
            expect(parsed.args.timestamp).to.be.greaterThan(0);
            found = true;
            break;
          }
        } catch {}
      }
      expect(found).to.be.true;
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // COLD CHAIN TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("Cold Chain Protection", function () {
    beforeEach(async function () {
      await traceability.connect(mfg1).mintBatch(insulinParams(), GAS);
    });

    it("should allow transfer within valid temperature range (4°C)", async function () {
      await expect(
        traceability.connect(mfg1).transferCustody(
          1, msd.address, "MSD Cold Store", 400, "Valid temp", GAS
        )
      ).to.not.be.reverted;
    });

    it("should block transfer above max temperature (25°C > 8°C)", async function () {
      await expect(
        traceability.connect(mfg1).transferCustody(
          1, msd.address, "Warm Storage", 2500, "Too hot", GAS
        )
      ).to.be.revertedWith("TC: cold-chain temperature violation");
    });

    it("should block transfer below min temperature (-5°C < 2°C)", async function () {
      await expect(
        traceability.connect(mfg1).transferCustody(
          1, msd.address, "Freezer", -500, "Too cold", GAS
        )
      ).to.be.revertedWith("TC: cold-chain temperature violation");
    });

    it("should allow transfer at exactly min temperature boundary (2°C)", async function () {
      await expect(
        traceability.connect(mfg1).transferCustody(
          1, msd.address, "Cold Store", 200, "Min boundary", GAS
        )
      ).to.not.be.reverted;
    });

    it("should allow transfer at exactly max temperature boundary (8°C)", async function () {
      await expect(
        traceability.connect(mfg1).transferCustody(
          1, msd.address, "Cold Store", 800, "Max boundary", GAS
        )
      ).to.not.be.reverted;
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // QR VERIFICATION TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("QR Verification", function () {
    let qrHash;

    beforeEach(async function () {
      await traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS);
      const batch = await traceability.getBatch(1);
      qrHash = batch.qrHash;
    });

    it("should verify authentic batch by QR hash", async function () {
      const tx = await traceability.connect(pharmacy).verifyByQR(qrHash, GAS);
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

    it("should return false for unknown QR hash", async function () {
      const fakeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("fake-qr"));
      const tx = await traceability.connect(pharmacy).verifyByQR(fakeHash, GAS);
      const receipt = await tx.wait();
      let isAuthentic = true;
      for (const log of receipt.logs) {
        try {
          const p = traceability.interface.parseLog(log);
          if (p.name === "QRVerified") { isAuthentic = p.args.isAuthentic; break; }
        } catch {}
      }
      expect(isAuthentic).to.be.false;
    });

    it("should emit QRVerified event", async function () {
      await expect(
        traceability.connect(pharmacy).verifyByQR(qrHash, GAS)
      ).to.emit(traceability, "QRVerified");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // RECALL TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("Recall", function () {
    beforeEach(async function () {
      await traceability.connect(mfg1).mintBatch(paracetamolParams(), GAS);
    });

    it("should recall batch and mark isRecalled = true", async function () {
      await traceability.connect(nmra).recallBatch(1, "Contamination detected", GAS);
      const batch = await traceability.getBatch(1);
      expect(batch.isRecalled).to.be.true;
      expect(Number(batch.status)).to.equal(6); // RECALLED
    });

    it("should increment totalRecalls", async function () {
      await traceability.connect(nmra).recallBatch(1, "Test recall", GAS);
      expect(await traceability.totalRecalls()).to.equal(1n);
    });

    it("should block custody transfer of recalled batch", async function () {
      await traceability.connect(nmra).recallBatch(1, "Recalled", GAS);
      await expect(
        traceability.connect(mfg1).transferCustody(
          1, spc.address, "Colombo", 2500, "Post-recall", GAS
        )
      ).to.be.revertedWith("TC: batch recalled");
    });

    it("should revert recall by non-NMRA", async function () {
      await expect(
        traceability.connect(pharmacy).recallBatch(1, "Unauthorized", GAS)
      ).to.be.revertedWith("TC: not NMRA");
    });

    it("should emit BatchRecalled event", async function () {
      await expect(
        traceability.connect(nmra).recallBatch(1, "Contaminated", GAS)
      ).to.emit(traceability, "BatchRecalled")
       .withArgs(1n, "Contaminated", nmra.address);
    });
  });
});