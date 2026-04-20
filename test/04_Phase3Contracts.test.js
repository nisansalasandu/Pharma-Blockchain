const { expect } = require("chai");
const hre = require("hardhat");

/**
 * test/04_Phase3Contracts.test.js
 * ────────────────────────────────
 * Unit tests for PredictiveAIOracle and ConsensusAdapter.
 * Tests: prediction submission, risk scoring, PoA↔PBFT switching, voting.
 *
 * Run: npx hardhat test test/04_Phase3Contracts.test.js
 */

const GAS = { gasLimit: 4000000 };

describe("PredictiveAIOracle", function () {
  let roleControl, oracle;
  let nmra, spc, stranger;

  beforeEach(async function () {
    [nmra, spc, , , , , , , , stranger] = await hre.ethers.getSigners();

    const RACFactory = await hre.ethers.getContractFactory("RoleAccessControl");
    roleControl = await RACFactory.deploy("NMRA", GAS);
    await roleControl.waitForDeployment();

    const OracleFactory = await hre.ethers.getContractFactory("PredictiveAIOracle");
    oracle = await OracleFactory.deploy(
      await roleControl.getAddress(), nmra.address, GAS
    );
    await oracle.waitForDeployment();
  });

  // ════════════════════════════════════════════════════════════════════════
  // PREDICTION SUBMISSION
  // ════════════════════════════════════════════════════════════════════════
  describe("submitPrediction", function () {
    it("should store prediction for paracetamol", async function () {
      await oracle.connect(nmra).submitPrediction(
        "paracetamol", 120, 45000, 50, 80, 150, GAS
      );
      const pred = await oracle.getPrediction("paracetamol");
      expect(pred.overallRisk).to.equal(150n);
      expect(pred.isValid).to.be.true;
    });

    it("should store all 5 risk metrics correctly", async function () {
      await oracle.connect(nmra).submitPrediction(
        "insulin", 820, 3200, 350, 120, 870, GAS
      );
      const pred = await oracle.getPrediction("insulin");
      expect(pred.stockDepletionRisk).to.equal(820n);
      expect(pred.demandForecast).to.equal(3200n);
      expect(pred.coldChainRisk).to.equal(350n);
      expect(pred.counterfeitRisk).to.equal(120n);
      expect(pred.overallRisk).to.equal(870n);
    });

    it("should increment totalPredictions", async function () {
      await oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 150, GAS);
      await oracle.connect(nmra).submitPrediction("insulin",     0, 0, 0, 0, 870, GAS);
      expect(await oracle.totalPredictions()).to.equal(2n);
    });

    it("should track new medicines in trackedMedicines array", async function () {
      await oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 150, GAS);
      await oracle.connect(nmra).submitPrediction("insulin",     0, 0, 0, 0, 870, GAS);
      const tracked = await oracle.getTrackedMedicines();
      expect(tracked.length).to.equal(2);
    });

    it("should not duplicate in trackedMedicines on update", async function () {
      await oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 150, GAS);
      await oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 200, GAS);
      const tracked = await oracle.getTrackedMedicines();
      expect(tracked.length).to.equal(1);
    });

    it("should update existing prediction", async function () {
      await oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 150, GAS);
      await oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 600, GAS);
      const risk = await oracle.getRiskScore("paracetamol");
      expect(risk).to.equal(600n);
    });

    it("should revert if risk > 1000", async function () {
      await expect(
        oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 1001, GAS)
      ).to.be.revertedWith("Oracle: risk > 1000");
    });

    it("should revert if called by non-operator", async function () {
      await expect(
        oracle.connect(stranger).submitPrediction("paracetamol", 0, 0, 0, 0, 150, GAS)
      ).to.be.revertedWith("Oracle: not authorised operator");
    });

    it("should emit PredictionSubmitted event", async function () {
      await expect(
        oracle.connect(nmra).submitPrediction("insulin", 820, 3200, 350, 120, 870, GAS)
      ).to.emit(oracle, "PredictionSubmitted");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ORDER EVALUATION
  // ════════════════════════════════════════════════════════════════════════
  describe("evaluateOrder", function () {
    it("should store risk score for order", async function () {
      await oracle.connect(nmra).submitPrediction("insulin", 0, 0, 0, 0, 870, GAS);
      await oracle.connect(nmra).evaluateOrder(42, "insulin", GAS);
      const risk = await oracle.getOrderRisk(42);
      expect(risk).to.equal(870n);
    });

    it("should return 0 for unknown medicine", async function () {
      await oracle.connect(nmra).evaluateOrder(99, "unknown-medicine", GAS);
      const risk = await oracle.getOrderRisk(99);
      expect(risk).to.equal(0n);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // STALENESS CHECK
  // ════════════════════════════════════════════════════════════════════════
  describe("isStale", function () {
    it("should return true for unknown medicine", async function () {
      const stale = await oracle.isStale("unknown", 3600);
      expect(stale).to.be.true;
    });

    it("should return false immediately after submission", async function () {
      await oracle.connect(nmra).submitPrediction("paracetamol", 0, 0, 0, 0, 150, GAS);
      const stale = await oracle.isStale("paracetamol", 3600);
      expect(stale).to.be.false;
    });
  });
});


// ══════════════════════════════════════════════════════════════════════════════
// CONSENSUS ADAPTER TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("ConsensusAdapter", function () {
  let roleControl, consensus;
  let nmra, spc, msd, stranger;

  beforeEach(async function () {
    [nmra, spc, msd, , , , , , , stranger] = await hre.ethers.getSigners();

    const RACFactory = await hre.ethers.getContractFactory("RoleAccessControl");
    roleControl = await RACFactory.deploy("NMRA", GAS);
    await roleControl.waitForDeployment();

    await roleControl.connect(nmra).grantRole(
      spc.address, await roleControl.ROLE_SPC(), "SPC", 0, GAS
    );
    await roleControl.connect(nmra).grantRole(
      msd.address, await roleControl.ROLE_MSD(), "MSD", 0, GAS
    );

    const CAFactory = await hre.ethers.getContractFactory("ConsensusAdapter");
    consensus = await CAFactory.deploy(
      await roleControl.getAddress(),
      nmra.address, spc.address, msd.address,
      GAS
    );
    await consensus.waitForDeployment();
  });

  // ════════════════════════════════════════════════════════════════════════
  // INITIAL STATE
  // ════════════════════════════════════════════════════════════════════════
  describe("Initial State", function () {
    it("should start in PoA mode", async function () {
      expect(await consensus.getCurrentMode()).to.equal(0n); // POA
    });

    it("should have 3 validators", async function () {
      expect(await consensus.validatorCount()).to.equal(3n);
    });

    it("should not be in PBFT initially", async function () {
      expect(await consensus.isInPBFT()).to.be.false;
    });

    it("should have no active event", async function () {
      expect(await consensus.getActiveEventId()).to.equal(0n);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POA → PBFT SWITCH
  // ════════════════════════════════════════════════════════════════════════
  describe("switchToPBFT", function () {
    it("should switch to PBFT mode", async function () {
      await consensus.connect(nmra).switchToPBFT(1, 870, 0, GAS);
      expect(await consensus.getCurrentMode()).to.equal(1n); // PBFT
      expect(await consensus.isInPBFT()).to.be.true;
    });

    it("should create a consensus event with correct data", async function () {
      await consensus.connect(nmra).switchToPBFT(42, 870, 0, GAS);
      const eventId = await consensus.getActiveEventId();
      expect(eventId).to.equal(1n);
    });

    it("should increment totalSwitches", async function () {
      await consensus.connect(nmra).switchToPBFT(1, 870, 0, GAS);
      expect(await consensus.totalSwitches()).to.equal(1n);
    });

    it("should revert if already in PBFT", async function () {
      await consensus.connect(nmra).switchToPBFT(1, 870, 0, GAS);
      await expect(
        consensus.connect(nmra).switchToPBFT(2, 900, 0, GAS)
      ).to.be.revertedWith("CA: already in PBFT");
    });

    it("should revert if non-NMRA tries to switch", async function () {
      await expect(
        consensus.connect(stranger).switchToPBFT(1, 870, 0, GAS)
      ).to.be.revertedWith("CA: not NMRA");
    });

    it("should emit ConsensusSwitched event", async function () {
      await expect(
        consensus.connect(nmra).switchToPBFT(1, 870, 0, GAS)
      ).to.emit(consensus, "ConsensusSwitched");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PBFT VOTING
  // ════════════════════════════════════════════════════════════════════════
  describe("castVote", function () {
    let eventId;
    const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test-order-1"));

    beforeEach(async function () {
      await consensus.connect(nmra).switchToPBFT(1, 870, 0, GAS);
      eventId = await consensus.getActiveEventId();
    });

    it("should accept vote from NMRA validator", async function () {
      await expect(
        consensus.connect(nmra).castVote(eventId, true, dataHash, GAS)
      ).to.emit(consensus, "ValidatorVoted")
       .withArgs(eventId, nmra.address, true);
    });

    it("should accept vote from SPC validator", async function () {
      await expect(
        consensus.connect(spc).castVote(eventId, true, dataHash, GAS)
      ).to.not.be.reverted;
    });

    it("should accept vote from MSD validator", async function () {
      await expect(
        consensus.connect(msd).castVote(eventId, true, dataHash, GAS)
      ).to.not.be.reverted;
    });

    it("should count approve votes correctly", async function () {
      await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(spc).castVote(eventId, true, dataHash, GAS);
      expect(await consensus.getVoteCount(eventId)).to.equal(2n);
    });

    it("should not count reject votes", async function () {
      await consensus.connect(nmra).castVote(eventId, false, dataHash, GAS);
      await consensus.connect(spc).castVote(eventId, true,  dataHash, GAS);
      expect(await consensus.getVoteCount(eventId)).to.equal(1n);
    });

    it("should emit PBFTRoundComplete after all 3 vote", async function () {
      await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(spc).castVote(eventId, true, dataHash, GAS);
      await expect(
        consensus.connect(msd).castVote(eventId, true, dataHash, GAS)
      ).to.emit(consensus, "PBFTRoundComplete")
       .withArgs(eventId, true);
    });

    it("should revert if non-validator tries to vote", async function () {
      await expect(
        consensus.connect(stranger).castVote(eventId, true, dataHash, GAS)
      ).to.be.revertedWith("CA: not a validator");
    });

    it("should revert if wrong eventId passed", async function () {
      await expect(
        consensus.connect(nmra).castVote(999n, true, dataHash, GAS)
      ).to.be.revertedWith("CA: wrong event");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // RESTORE POA
  // ════════════════════════════════════════════════════════════════════════
  describe("restorePoA", function () {
    let eventId;
    const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test-order-1"));

    beforeEach(async function () {
      await consensus.connect(nmra).switchToPBFT(1, 870, 0, GAS);
      eventId = await consensus.getActiveEventId();
      await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(spc).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(msd).castVote(eventId, true, dataHash, GAS);
    });

    it("should restore to PoA mode", async function () {
      await consensus.connect(nmra).restorePoA(eventId, GAS);
      expect(await consensus.getCurrentMode()).to.equal(0n); // POA
      expect(await consensus.isInPBFT()).to.be.false;
    });

    it("should clear activeEventId", async function () {
      await consensus.connect(nmra).restorePoA(eventId, GAS);
      expect(await consensus.getActiveEventId()).to.equal(0n);
    });

    it("should allow new PBFT round after restoration", async function () {
      await consensus.connect(nmra).restorePoA(eventId, GAS);
      await expect(
        consensus.connect(nmra).switchToPBFT(2, 900, 0, GAS)
      ).to.not.be.reverted;
    });

    it("should revert if non-NMRA tries to restore", async function () {
      await expect(
        consensus.connect(stranger).restorePoA(eventId, GAS)
      ).to.be.revertedWith("CA: not NMRA");
    });

    it("should emit ConsensusRestored event", async function () {
      await expect(
        consensus.connect(nmra).restorePoA(eventId, GAS)
      ).to.emit(consensus, "ConsensusRestored");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // FULL CYCLE TEST
  // ════════════════════════════════════════════════════════════════════════
  describe("Full PoA → PBFT → PoA cycle", function () {
    it("should complete a full consensus cycle successfully", async function () {
      const dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("order-1-risk-870"));

      // PoA → PBFT
      expect(await consensus.isInPBFT()).to.be.false;
      await consensus.connect(nmra).switchToPBFT(1, 870, 0, GAS);
      expect(await consensus.isInPBFT()).to.be.true;

      const eventId = await consensus.getActiveEventId();

      // Vote
      await consensus.connect(nmra).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(spc).castVote(eventId, true, dataHash, GAS);
      await consensus.connect(msd).castVote(eventId, true, dataHash, GAS);
      expect(await consensus.getVoteCount(eventId)).to.equal(3n);

      // PBFT → PoA
      await consensus.connect(nmra).restorePoA(eventId, GAS);
      expect(await consensus.isInPBFT()).to.be.false;
      expect(await consensus.totalSwitches()).to.equal(1n);
    });
  });
});