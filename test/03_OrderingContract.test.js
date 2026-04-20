const { expect } = require("chai");
const hre = require("hardhat");

/**
 * test/03_OrderingContract.test.js
 * ─────────────────────────────────
 * Unit tests for OrderingContract.
 * Tests: order placement, AI risk routing, PoA approval, PBFT emergency path.
 *
 * Run: npx hardhat test test/03_OrderingContract.test.js
 */

const GAS = { gasLimit: 4000000 };

describe("OrderingContract", function () {
  let roleControl, ordering;
  let nmra, spc, msd, mfg1, pharmacy, hospital, stranger;

  beforeEach(async function () {
    [nmra, spc, msd, mfg1, , , , pharmacy, hospital] =
      await hre.ethers.getSigners();
    stranger = (await hre.ethers.getSigners())[9];

    // Deploy RoleAccessControl
    const RACFactory = await hre.ethers.getContractFactory("RoleAccessControl");
    roleControl = await RACFactory.deploy("NMRA", GAS);
    await roleControl.waitForDeployment();

    // Grant roles
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

    // Deploy OrderingContract
    const OCFactory = await hre.ethers.getContractFactory("OrderingContract");
    ordering = await OCFactory.deploy(
      await roleControl.getAddress(), nmra.address, GAS
    );
    await ordering.waitForDeployment();
  });

  // ════════════════════════════════════════════════════════════════════════
  // PLACE ORDER TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("placeOrder", function () {
    it("should allow pharmacy to place order to SPC", async function () {
      const tx = await ordering.connect(pharmacy).placeOrder(
        spc.address, "Panadol 500mg", "Paracetamol",
        10000, hre.ethers.parseEther("0.0001"),
        "Monthly stock", GAS
      );
      const receipt = await tx.wait();
      let orderId;
      for (const log of receipt.logs) {
        try {
          const p = ordering.interface.parseLog(log);
          if (p.name === "OrderPlaced") { orderId = p.args.orderId; break; }
        } catch {}
      }
      expect(orderId).to.equal(1n);
    });

    it("should allow hospital to place order to MSD", async function () {
      await expect(
        ordering.connect(hospital).placeOrder(
          msd.address, "Insulin", "Human Insulin",
          2000, hre.ethers.parseEther("0.001"),
          "ICU stock", GAS
        )
      ).to.emit(ordering, "OrderPlaced");
    });

    it("should set initial status to AI_REVIEW", async function () {
      await ordering.connect(pharmacy).placeOrder(
        spc.address, "Panadol", "Paracetamol",
        5000, 0n, "Test", GAS
      );
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(1); // AI_REVIEW
    });

    it("should revert if non-pharmacy/hospital tries to order", async function () {
      await expect(
        ordering.connect(mfg1).placeOrder(
          spc.address, "Panadol", "Paracetamol",
          5000, 0n, "Test", GAS
        )
      ).to.be.revertedWith("OC: must be PHARMACY or HOSPITAL");
    });

    it("should revert if quantity is zero", async function () {
      await expect(
        ordering.connect(pharmacy).placeOrder(
          spc.address, "Panadol", "Paracetamol",
          0, 0n, "Test", GAS
        )
      ).to.be.revertedWith("OC: zero quantity");
    });

    it("should revert if supplier is zero address", async function () {
      await expect(
        ordering.connect(pharmacy).placeOrder(
          hre.ethers.ZeroAddress, "Panadol", "Paracetamol",
          5000, 0n, "Test", GAS
        )
      ).to.be.revertedWith("OC: zero supplier");
    });

    it("should store order details correctly", async function () {
      await ordering.connect(pharmacy).placeOrder(
        spc.address, "Panadol 500mg", "Paracetamol 500mg",
        10000, 100n, "Stock", GAS
      );
      const order = await ordering.getOrder(1);
      expect(order.placer).to.equal(pharmacy.address);
      expect(order.supplier).to.equal(spc.address);
      expect(order.medicineName).to.equal("Panadol 500mg");
      expect(order.quantity).to.equal(10000n);
      expect(order.totalValueWei).to.equal(1000000n);
    });

    it("should increment totalOrders", async function () {
      await ordering.connect(pharmacy).placeOrder(
        spc.address, "Med A", "Generic A", 100, 0n, "", GAS
      );
      await ordering.connect(hospital).placeOrder(
        msd.address, "Med B", "Generic B", 200, 0n, "", GAS
      );
      const [total] = await ordering.getStats();
      expect(total).to.equal(2n);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // AI RISK SCORE TESTS — THE CORE RESEARCH CONTRIBUTION
  // ════════════════════════════════════════════════════════════════════════
  describe("setRiskScore — AI Consensus Routing", function () {
    beforeEach(async function () {
      await ordering.connect(pharmacy).placeOrder(
        spc.address, "Panadol", "Paracetamol", 5000, 0n, "Test", GAS
      );
    });

    it("LOW risk (300) → PENDING status → PoA path", async function () {
      await ordering.connect(nmra).setRiskScore(1, 300, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(0);   // PENDING
      expect(Number(order.path)).to.equal(0);     // STANDARD
    });

    it("HIGH risk (900) → EMERGENCY status → PBFT path", async function () {
      await ordering.connect(nmra).setRiskScore(1, 900, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(3);   // EMERGENCY
      expect(Number(order.path)).to.equal(1);     // EMERGENCY path
    });

    it("boundary score (800) → PENDING (not emergency)", async function () {
      await ordering.connect(nmra).setRiskScore(1, 800, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(0);   // PENDING — 800 is NOT > 800
    });

    it("boundary score (801) → EMERGENCY", async function () {
      await ordering.connect(nmra).setRiskScore(1, 801, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(3);   // EMERGENCY
    });

    it("should increment totalEmergencyOrders for high risk", async function () {
      await ordering.connect(nmra).setRiskScore(1, 900, GAS);
      const [, , emergency] = await ordering.getStats();
      expect(emergency).to.equal(1n);
    });

    it("should revert if risk score > 1000", async function () {
      await expect(
        ordering.connect(nmra).setRiskScore(1, 1001, GAS)
      ).to.be.revertedWith("OC: score > 1000");
    });

    it("should revert if called on wrong status", async function () {
      await ordering.connect(nmra).setRiskScore(1, 300, GAS); // moves to PENDING
      await expect(
        ordering.connect(nmra).setRiskScore(1, 500, GAS)
      ).to.be.revertedWith("OC: wrong status");
    });

    it("should emit RiskScoreSet event", async function () {
      await expect(
        ordering.connect(nmra).setRiskScore(1, 300, GAS)
      ).to.emit(ordering, "RiskScoreSet");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // POA APPROVAL PATH TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("PoA Approval Path (Standard)", function () {
    beforeEach(async function () {
      await ordering.connect(pharmacy).placeOrder(
        spc.address, "Panadol", "Paracetamol", 5000, 0n, "", GAS
      );
      await ordering.connect(nmra).setRiskScore(1, 300, GAS); // → PENDING
    });

    it("should allow SPC to approve standard order", async function () {
      await ordering.connect(spc).approveOrder(1, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(2); // APPROVED
    });

    it("should set approvedBy to SPC address", async function () {
      await ordering.connect(spc).approveOrder(1, GAS);
      const order = await ordering.getOrder(1);
      expect(order.approvedBy).to.equal(spc.address);
    });

    it("should revert if wrong supplier tries to approve", async function () {
      await expect(
        ordering.connect(msd).approveOrder(1, GAS)
      ).to.be.revertedWith("OC: not supplier");
    });

    it("should allow SPC to fulfill after approval", async function () {
      await ordering.connect(spc).approveOrder(1, GAS);
      await ordering.connect(spc).fulfillOrder(1, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(4); // FULFILLED
    });

    it("should increment totalFulfilled after fulfillment", async function () {
      await ordering.connect(spc).approveOrder(1, GAS);
      await ordering.connect(spc).fulfillOrder(1, GAS);
      const [, fulfilled] = await ordering.getStats();
      expect(fulfilled).to.equal(1n);
    });

    it("should allow rejection with reason", async function () {
      await ordering.connect(spc).rejectOrder(1, "Out of stock", GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(5); // REJECTED
      expect(order.rejectionReason).to.equal("Out of stock");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PBFT EMERGENCY PATH TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("PBFT Emergency Path", function () {
    beforeEach(async function () {
      await ordering.connect(hospital).placeOrder(
        msd.address, "Insulin", "Human Insulin", 2000, 0n,
        "ICU URGENT", GAS
      );
      await ordering.connect(nmra).setRiskScore(1, 900, GAS); // → EMERGENCY
    });

    it("should be in EMERGENCY status after high risk score", async function () {
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(3); // EMERGENCY
    });

    it("should only allow NMRA to approve emergency order", async function () {
      await ordering.connect(nmra).approveEmergencyOrder(1, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(2); // APPROVED
      expect(order.approvedBy).to.equal(nmra.address);
    });

    it("should revert if SPC tries to approve emergency order", async function () {
      await expect(
        ordering.connect(spc).approveEmergencyOrder(1, GAS)
      ).to.be.revertedWith("OC: not NMRA");
    });

    it("should revert if standard approveOrder called on EMERGENCY status", async function () {
      await expect(
        ordering.connect(msd).approveOrder(1, GAS)
      ).to.be.revertedWith("OC: wrong status");
    });

    it("should allow MSD to fulfill after NMRA approval", async function () {
      await ordering.connect(nmra).approveEmergencyOrder(1, GAS);
      await ordering.connect(msd).fulfillOrder(1, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(4); // FULFILLED
    });

    it("should emit OrderEmergency event", async function () {
      // Place new order for this test
      await ordering.connect(hospital).placeOrder(
        msd.address, "Vaccine", "VaccineX", 500, 0n, "URGENT", GAS
      );
      await expect(
        ordering.connect(nmra).setRiskScore(2, 850, GAS)
      ).to.emit(ordering, "OrderEmergency");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // CANCELLATION TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("cancelOrder", function () {
    it("should allow placer to cancel a pending order", async function () {
      await ordering.connect(pharmacy).placeOrder(
        spc.address, "Med", "Gen", 100, 0n, "", GAS
      );
      await ordering.connect(pharmacy).cancelOrder(1, GAS);
      const order = await ordering.getOrder(1);
      expect(Number(order.status)).to.equal(6); // CANCELLED
    });

    it("should revert if non-placer tries to cancel", async function () {
      await ordering.connect(pharmacy).placeOrder(
        spc.address, "Med", "Gen", 100, 0n, "", GAS
      );
      await expect(
        ordering.connect(hospital).cancelOrder(1, GAS)
      ).to.be.revertedWith("OC: not placer");
    });
  });
});