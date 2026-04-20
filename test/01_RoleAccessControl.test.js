const { expect } = require("chai");
const hre = require("hardhat");

/**
 * test/01_RoleAccessControl.test.js
 * ──────────────────────────────────
 * Unit tests for RoleAccessControl contract.
 * Tests: role granting, revoking, license NFTs, access modifiers.
 *
 * Run: npx hardhat test test/01_RoleAccessControl.test.js
 */

const GAS = { gasLimit: 4000000 };

describe("RoleAccessControl", function () {
  let roleControl;
  let nmra, spc, msd, mfg1, mfg2, pharmacy, hospital, stranger;

  // ── Deploy fresh contract before each test ──────────────────────────────
  beforeEach(async function () {
    [nmra, spc, msd, mfg1, mfg2, , , pharmacy, hospital, , stranger] =
      await hre.ethers.getSigners();

    const Factory = await hre.ethers.getContractFactory("RoleAccessControl");
    roleControl   = await Factory.deploy("National Medicines Regulatory Authority", GAS);
    await roleControl.waitForDeployment();
  });

  // ════════════════════════════════════════════════════════════════════════
  // DEPLOYMENT TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("Deployment", function () {
    it("should deploy with NMRA role assigned to deployer", async function () {
      const role = await roleControl.getRole(nmra.address);
      const ROLE_NMRA = await roleControl.ROLE_NMRA();
      expect(role).to.equal(ROLE_NMRA);
    });

    it("should set deployer as nmraAddress", async function () {
      expect(await roleControl.nmraAddress()).to.equal(nmra.address);
    });

    it("should start with totalMembers = 1", async function () {
      expect(await roleControl.totalMembers()).to.equal(1n);
    });

    it("should mark NMRA as active", async function () {
      const active = await roleControl.isActiveRole(nmra.address, await roleControl.ROLE_NMRA());
      expect(active).to.be.true;
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ROLE GRANTING TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("grantRole", function () {
    it("should allow NMRA to grant SPC role", async function () {
      await roleControl.connect(nmra).grantRole(
        spc.address, await roleControl.ROLE_SPC(),
        "State Pharmaceuticals Corporation", 0, GAS
      );
      const role = await roleControl.getRole(spc.address);
      expect(role).to.equal(await roleControl.ROLE_SPC());
    });

    it("should increment totalMembers after grant", async function () {
      await roleControl.connect(nmra).grantRole(
        spc.address, await roleControl.ROLE_SPC(), "SPC", 0, GAS
      );
      expect(await roleControl.totalMembers()).to.equal(2n);
    });

    it("should revert if non-NMRA tries to grant role", async function () {
      await expect(
        roleControl.connect(spc).grantRole(
          mfg1.address, await roleControl.ROLE_MANUFACTURER(), "Fake MFG", 0, GAS
        )
      ).to.be.revertedWith("RoleAccessControl: caller is not NMRA");
    });

    it("should revert if granting to zero address", async function () {
      await expect(
        roleControl.connect(nmra).grantRole(
          hre.ethers.ZeroAddress, await roleControl.ROLE_SPC(), "SPC", 0, GAS
        )
      ).to.be.revertedWith("RAC: zero address");
    });

    it("should revert if account already has active role", async function () {
      await roleControl.connect(nmra).grantRole(
        spc.address, await roleControl.ROLE_SPC(), "SPC", 0, GAS
      );
      await expect(
        roleControl.connect(nmra).grantRole(
          spc.address, await roleControl.ROLE_MSD(), "MSD", 0, GAS
        )
      ).to.be.revertedWith("RAC: already active");
    });

    it("should emit RoleGranted event", async function () {
      await expect(
        roleControl.connect(nmra).grantRole(
          spc.address, await roleControl.ROLE_SPC(), "SPC", 0, GAS
        )
      ).to.emit(roleControl, "RoleGranted")
       .withArgs(spc.address, await roleControl.ROLE_SPC(), "SPC", nmra.address);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ROLE REVOKING TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("revokeRole", function () {
    beforeEach(async function () {
      await roleControl.connect(nmra).grantRole(
        spc.address, await roleControl.ROLE_SPC(), "SPC", 0, GAS
      );
    });

    it("should deactivate member after revoke", async function () {
      await roleControl.connect(nmra).revokeRole(spc.address, GAS);
      const active = await roleControl.isActiveRole(spc.address, await roleControl.ROLE_SPC());
      expect(active).to.be.false;
    });

    it("should revert if non-NMRA tries to revoke", async function () {
      await expect(
        roleControl.connect(stranger).revokeRole(spc.address, GAS)
      ).to.be.revertedWith("RoleAccessControl: caller is not NMRA");
    });

    it("should revert if trying to revoke NMRA itself", async function () {
      await expect(
        roleControl.connect(nmra).revokeRole(nmra.address, GAS)
      ).to.be.revertedWith("RoleAccessControl: cannot revoke NMRA");
    });

    it("should emit RoleRevoked event", async function () {
      await expect(
        roleControl.connect(nmra).revokeRole(spc.address, GAS)
      ).to.emit(roleControl, "RoleRevoked");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // LICENSE NFT TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("issueLicense", function () {
    beforeEach(async function () {
      await roleControl.connect(nmra).grantRole(
        mfg1.address, await roleControl.ROLE_MANUFACTURER(),
        "Lanka Pharmaceuticals Ltd", 0, GAS
      );
    });

    it("should issue license to registered manufacturer", async function () {
      const tx = await roleControl.connect(nmra).issueLicense(
        mfg1.address, "NMRA/MFG/2024/001", 365, GAS
      );
      await tx.wait();
      const tokenId = await roleControl.addressToLicense(mfg1.address);
      expect(tokenId).to.equal(1n);
    });

    it("should store correct license details", async function () {
      await roleControl.connect(nmra).issueLicense(
        mfg1.address, "NMRA/MFG/2024/001", 365, GAS
      );
      const lic = await roleControl.getLicense(1);
      expect(lic.holder).to.equal(mfg1.address);
      expect(lic.licenseNumber).to.equal("NMRA/MFG/2024/001");
      expect(lic.isValid).to.be.true;
    });

    it("should revert issuing license to unregistered address", async function () {
      await expect(
        roleControl.connect(nmra).issueLicense(
          stranger.address, "NMRA/MFG/2024/999", 365, GAS
        )
      ).to.be.revertedWith("RAC: holder not active");
    });

    it("should revoke license correctly", async function () {
      await roleControl.connect(nmra).issueLicense(
        mfg1.address, "NMRA/MFG/2024/001", 365, GAS
      );
      await roleControl.connect(nmra).revokeLicense(1, GAS);
      const lic = await roleControl.getLicense(1);
      expect(lic.isValid).to.be.false;
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ALL 10 ROLES TEST
  // ════════════════════════════════════════════════════════════════════════
  describe("All 10 roles", function () {
    it("should support all 10 role constants", async function () {
      const roles = [
        "ROLE_NMRA", "ROLE_SPC", "ROLE_MSD", "ROLE_MANUFACTURER",
        "ROLE_IMPORTER", "ROLE_WHOLESALER", "ROLE_PHARMACY",
        "ROLE_HOSPITAL", "ROLE_TRANSPORTER", "ROLE_PATIENT"
      ];
      for (const r of roles) {
        const val = await roleControl[r]();
        expect(val).to.not.equal(hre.ethers.ZeroHash);
      }
    });

    it("should grant all supply chain roles successfully", async function () {
      const signers = await hre.ethers.getSigners();
      const grants = [
        { addr: signers[1].address, role: "ROLE_SPC",         name: "SPC" },
        { addr: signers[2].address, role: "ROLE_MSD",         name: "MSD" },
        { addr: signers[3].address, role: "ROLE_MANUFACTURER",name: "MFG" },
        { addr: signers[4].address, role: "ROLE_IMPORTER",    name: "IMP" },
        { addr: signers[5].address, role: "ROLE_WHOLESALER",  name: "WHL" },
        { addr: signers[6].address, role: "ROLE_PHARMACY",    name: "PHM" },
        { addr: signers[7].address, role: "ROLE_HOSPITAL",    name: "HSP" },
        { addr: signers[8].address, role: "ROLE_TRANSPORTER", name: "TRN" },
      ];
      for (const g of grants) {
        await roleControl.connect(nmra).grantRole(
          g.addr, await roleControl[g.role](), g.name, 0, GAS
        );
        const active = await roleControl.isActiveRole(g.addr, await roleControl[g.role]());
        expect(active).to.be.true;
      }
      expect(await roleControl.totalMembers()).to.equal(9n);
    });
  });
});