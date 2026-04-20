// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title RoleAccessControl
 * @dev Hierarchical role management for Sri Lankan Pharmaceutical Supply Chain
 *
 * ROLES (in order of authority):
 *   NMRA        → Top regulator, can grant/revoke all roles
 *   SPC         → Government importer, manages national procurement
 *   MSD         → Government distributor, manages hospital supply
 *   MANUFACTURER → Creates and mints medicine batches
 *   IMPORTER    → Licensed private importer
 *   WHOLESALER  → Distributor to private pharmacies
 *   PHARMACY    → Retail pharmacy, places orders
 *   HOSPITAL    → Hospital pharmacy, places orders via MSD
 *   TRANSPORTER → Cold-chain logistics provider
 *   PATIENT     → Light client, read-only QR verification
 */
contract RoleAccessControl {

    // ─── ROLE CONSTANTS ───────────────────────────────────────────────────────
    bytes32 public constant ROLE_NMRA        = keccak256("NMRA");
    bytes32 public constant ROLE_SPC         = keccak256("SPC");
    bytes32 public constant ROLE_MSD         = keccak256("MSD");
    bytes32 public constant ROLE_MANUFACTURER = keccak256("MANUFACTURER");
    bytes32 public constant ROLE_IMPORTER    = keccak256("IMPORTER");
    bytes32 public constant ROLE_WHOLESALER  = keccak256("WHOLESALER");
    bytes32 public constant ROLE_PHARMACY    = keccak256("PHARMACY");
    bytes32 public constant ROLE_HOSPITAL    = keccak256("HOSPITAL");
    bytes32 public constant ROLE_TRANSPORTER = keccak256("TRANSPORTER");
    bytes32 public constant ROLE_PATIENT     = keccak256("PATIENT");

    // ─── STRUCTS ──────────────────────────────────────────────────────────────
    struct Member {
        bytes32 role;
        string  orgName;
        bool    isActive;
        address grantedBy;
        uint256 grantedAt;
        uint256 licenseExpiry;   // 0 = no expiry
    }

    struct LicenseNFT {
        uint256 tokenId;
        address holder;
        bytes32 role;
        string  licenseNumber;   // e.g. "NMRA/MFG/2024/001"
        uint256 issuedAt;
        uint256 expiresAt;
        bool    isValid;
    }

    // ─── STATE ────────────────────────────────────────────────────────────────
    address public nmraAddress;
    uint256 public totalMembers;
    uint256 private _licenseCounter;

    mapping(address => Member)     public members;
    mapping(uint256 => LicenseNFT) public licenses;
    mapping(address => uint256)    public addressToLicense;   // address → tokenId
    mapping(bytes32 => address[])  public roleMembers;         // role → addresses

    // ─── EVENTS ───────────────────────────────────────────────────────────────
    event RoleGranted(address indexed account, bytes32 role, string orgName, address grantedBy);
    event RoleRevoked(address indexed account, bytes32 role, address revokedBy);
    event LicenseIssued(uint256 tokenId, address holder, string licenseNumber);
    event LicenseRevoked(uint256 tokenId, address holder);
    event LicenseExpired(uint256 tokenId, address holder);

    // ─── MODIFIERS ────────────────────────────────────────────────────────────
    modifier onlyNMRA() {
        require(members[msg.sender].role == ROLE_NMRA && members[msg.sender].isActive,
            "RoleAccessControl: caller is not NMRA");
        _;
    }

    modifier onlyActive() {
        require(members[msg.sender].isActive,
            "RoleAccessControl: caller account is not active");
        _;
    }

    modifier hasRole(bytes32 _role) {
        require(members[msg.sender].role == _role && members[msg.sender].isActive,
            "RoleAccessControl: missing required role");
        _;
    }

    modifier hasAnyRole(bytes32 _r1, bytes32 _r2) {
        require(
            (members[msg.sender].role == _r1 || members[msg.sender].role == _r2)
            && members[msg.sender].isActive,
            "RoleAccessControl: missing required role"
        );
        _;
    }

    // ─── CONSTRUCTOR ──────────────────────────────────────────────────────────
    /**
     * @dev Deploys the contract and registers the deployer as NMRA.
     *      In production, deployer = Account 0 (NMRA) from Ganache.
     */
    constructor(string memory _nmraOrgName) {
        nmraAddress = msg.sender;

        members[msg.sender].role          = ROLE_NMRA;
        members[msg.sender].orgName       = _nmraOrgName;
        members[msg.sender].isActive      = true;
        members[msg.sender].grantedBy     = msg.sender;
        members[msg.sender].grantedAt     = block.timestamp;
        members[msg.sender].licenseExpiry = 0;

        roleMembers[ROLE_NMRA].push(msg.sender);
        totalMembers = 1;

        emit RoleGranted(msg.sender, ROLE_NMRA, _nmraOrgName, msg.sender);
    }

    // ─── ROLE MANAGEMENT ─────────────────────────────────────────────────────

    /**
     * @dev NMRA grants a role to an address.
     * @param _account  Wallet address of the organisation
     * @param _role     Role constant (e.g. ROLE_SPC)
     * @param _orgName  Human-readable organisation name
     * @param _expiry   Unix timestamp for expiry; pass 0 for no expiry
     */
    function grantRole(
        address _account,
        bytes32 _role,
        string  memory _orgName,
        uint256 _expiry
    ) external onlyNMRA {
        require(_account != address(0),      "RAC: zero address");
        require(!members[_account].isActive, "RAC: already active");
        require(_role != bytes32(0),         "RAC: invalid role");

        members[_account].role          = _role;
        members[_account].orgName       = _orgName;
        members[_account].isActive      = true;
        members[_account].grantedBy     = msg.sender;
        members[_account].grantedAt     = block.timestamp;
        members[_account].licenseExpiry = _expiry;

        roleMembers[_role].push(_account);
        totalMembers++;

        emit RoleGranted(_account, _role, _orgName, msg.sender);
    }

    /**
     * @dev NMRA revokes a role from an address.
     */
    function revokeRole(address _account) external onlyNMRA {
        require(members[_account].isActive, "RoleAccessControl: account not active");
        require(_account != nmraAddress,    "RoleAccessControl: cannot revoke NMRA");

        bytes32 role = members[_account].role;
        members[_account].isActive = false;

        emit RoleRevoked(_account, role, msg.sender);
    }

    // ─── LICENSE NFT ─────────────────────────────────────────────────────────

    /**
     * @dev NMRA issues a licence NFT to a registered member.
     * @param _holder       Address of the licence holder
     * @param _licenseNumber Official NMRA licence number string
     * @param _validDays    Validity in days (e.g. 365)
     */
    function issueLicense(
        address _holder,
        string  memory _licenseNumber,
        uint256 _validDays
    ) external onlyNMRA returns (uint256) {
        require(members[_holder].isActive, "RAC: holder not active");

        _licenseCounter++;
        uint256 tid = _licenseCounter;

        licenses[tid].tokenId       = tid;
        licenses[tid].holder        = _holder;
        licenses[tid].role          = members[_holder].role;
        licenses[tid].licenseNumber = _licenseNumber;
        licenses[tid].issuedAt      = block.timestamp;
        licenses[tid].expiresAt     = block.timestamp + (_validDays * 1 days);
        licenses[tid].isValid       = true;

        addressToLicense[_holder] = tid;

        emit LicenseIssued(tid, _holder, _licenseNumber);
        return tid;
    }

    /**
     * @dev NMRA revokes a licence.
     */
    function revokeLicense(uint256 _tokenId) external onlyNMRA {
        require(licenses[_tokenId].isValid, "RoleAccessControl: licence not valid");
        licenses[_tokenId].isValid = false;
        emit LicenseRevoked(_tokenId, licenses[_tokenId].holder);
    }

    // ─── READ FUNCTIONS ──────────────────────────────────────────────────────

    function getRole(address _account) external view returns (bytes32) {
        return members[_account].role;
    }

    function isActiveRole(address _account, bytes32 _role) external view returns (bool) {
        return members[_account].role == _role && members[_account].isActive;
    }

    function getMember(address _account)
        external view
        returns (
            bytes32 role,
            string memory orgName,
            bool isActive,
            address grantedBy,
            uint256 grantedAt,
            uint256 licenseExpiry
        )
    {
        Member memory m = members[_account];
        return (m.role, m.orgName, m.isActive, m.grantedBy, m.grantedAt, m.licenseExpiry);
    }

    function hasValidLicense(address _account) external view returns (bool) {
        uint256 tokenId = addressToLicense[_account];
        if (tokenId == 0) return false;
        LicenseNFT memory lic = licenses[tokenId];
        return lic.isValid && block.timestamp <= lic.expiresAt;
    }

    function getLicense(uint256 _tokenId)
        external view
        returns (
            address holder,
            bytes32 role,
            string memory licenseNumber,
            uint256 issuedAt,
            uint256 expiresAt,
            bool isValid
        )
    {
        LicenseNFT memory lic = licenses[_tokenId];
        return (lic.holder, lic.role, lic.licenseNumber, lic.issuedAt, lic.expiresAt, lic.isValid);
    }

    function getRoleMembers(bytes32 _role) external view returns (address[] memory) {
        return roleMembers[_role];
    }

    function roleName(bytes32 _role) external pure returns (string memory) {
        if (_role == keccak256("NMRA"))         return "NMRA";
        if (_role == keccak256("SPC"))          return "SPC";
        if (_role == keccak256("MSD"))          return "MSD";
        if (_role == keccak256("MANUFACTURER")) return "MANUFACTURER";
        if (_role == keccak256("IMPORTER"))     return "IMPORTER";
        if (_role == keccak256("WHOLESALER"))   return "WHOLESALER";
        if (_role == keccak256("PHARMACY"))     return "PHARMACY";
        if (_role == keccak256("HOSPITAL"))     return "HOSPITAL";
        if (_role == keccak256("TRANSPORTER"))  return "TRANSPORTER";
        if (_role == keccak256("PATIENT"))      return "PATIENT";
        return "UNKNOWN";
    }
}
