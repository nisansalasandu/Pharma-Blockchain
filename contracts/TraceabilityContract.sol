// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./RoleAccessControl.sol";

/**
 * @title TraceabilityContract  (stack-safe version)
 * @dev   Tracks pharmaceutical batches from manufacture to patient.
 *
 * Stack discipline rules applied throughout:
 *   - No function uses more than 8 named local variables
 *   - transferCustody splits logic into _updateStatus() and _recordCustody()
 *   - verifyByQR returns a simple struct instead of 6 bare values
 *   - No viaIR required
 */
contract TraceabilityContract {

    RoleAccessControl public roleControl;

    // ─── ENUMS ────────────────────────────────────────────────────────────────
    enum BatchStatus {
        MANUFACTURED,
        IN_TRANSIT,
        AT_WAREHOUSE,
        AT_PHARMACY,
        AT_HOSPITAL,
        DISPENSED,
        RECALLED,
        EXPIRED
    }

    // ─── STRUCTS ──────────────────────────────────────────────────────────────
    struct Batch {
        uint256     tokenId;
        string      medicineName;
        string      batchNumber;
        string      genericName;
        uint256     quantity;
        uint256     manufacturedDate;
        uint256     expiryDate;
        address     manufacturer;
        address     currentHolder;
        BatchStatus status;
        bool        coldChainRequired;
        int256      minTemp;
        int256      maxTemp;
        bytes32     qrHash;
        string      ipfsCertificate;
        bool        isRecalled;
    }

    struct CustodyRecord {
        address from;
        address to;
        uint256 timestamp;
        string  location;
        int256  recordedTemp;
        string  notes;
    }

    // Input struct for mintBatch — keeps stack depth at 1 slot
    struct BatchParams {
        string  medicineName;
        string  batchNumber;
        string  genericName;
        uint256 quantity;
        uint256 expiryDate;
        bool    coldChainRequired;
        int256  minTemp;
        int256  maxTemp;
        string  qrPayload;
        string  ipfsCert;
    }

    // Return struct for verifyByQR — avoids 6 bare return values on stack
    struct VerifyResult {
        uint256     tokenId;
        bool        isAuthentic;
        string      medicineName;
        string      batchNumber;
        BatchStatus status;
        uint256     expiryDate;
    }

    // ─── STATE ────────────────────────────────────────────────────────────────
    uint256 private _tokenCounter;
    uint256 public  totalBatches;
    uint256 public  totalRecalls;

    mapping(uint256 => Batch)           public batches;
    mapping(uint256 => CustodyRecord[]) public custodyHistory;
    mapping(bytes32 => uint256)         public qrHashToBatch;
    mapping(address => uint256[])       public holderBatches;

    // ─── EVENTS ───────────────────────────────────────────────────────────────
    event BatchMinted(uint256 indexed tokenId, string batchNumber,
                      string medicineName, address manufacturer, uint256 quantity);
    event CustodyTransferred(uint256 indexed tokenId, address indexed from,
                             address indexed to, string location, uint256 timestamp);
    event BatchRecalled(uint256 indexed tokenId, string reason, address recalledBy);
    event QRVerified(uint256 indexed tokenId, address verifier, bool isAuthentic);

    // ─── MODIFIERS ────────────────────────────────────────────────────────────
    modifier onlyManufacturerOrImporter() {
        require(
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_MANUFACTURER()) ||
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_IMPORTER()),
            "TC: must be MANUFACTURER or IMPORTER"
        );
        _;
    }

    modifier onlyCurrentHolder(uint256 _tokenId) {
        require(batches[_tokenId].currentHolder == msg.sender, "TC: not current holder");
        _;
    }

    modifier onlyNMRA() {
        require(roleControl.isActiveRole(msg.sender, roleControl.ROLE_NMRA()), "TC: not NMRA");
        _;
    }

    modifier batchExists(uint256 _tokenId) {
        require(_tokenId > 0 && _tokenId <= _tokenCounter, "TC: batch not found");
        _;
    }

    modifier notRecalled(uint256 _tokenId) {
        require(!batches[_tokenId].isRecalled, "TC: batch recalled");
        _;
    }

    // ─── CONSTRUCTOR ──────────────────────────────────────────────────────────
    constructor(address _roleControl) {
        roleControl = RoleAccessControl(_roleControl);
    }

    // ─── MINT ─────────────────────────────────────────────────────────────────

    /**
     * @dev Mint a new batch NFT. All 10 fields passed as a struct (1 stack slot).
     *
     * JS call:
     *   await traceability.connect(mfg1).mintBatch({
     *     medicineName: "Panadol 500mg", batchNumber: "PCM-2024-001",
     *     genericName: "Paracetamol 500mg", quantity: 50000,
     *     expiryDate: timestamp, coldChainRequired: false,
     *     minTemp: 0, maxTemp: 3500,
     *     qrPayload: "PCM-2024-001:MFG1", ipfsCert: "ipfs://Qm..."
     *   });
     */
    function mintBatch(BatchParams calldata p)
        external
        onlyManufacturerOrImporter
        returns (uint256)
    {
        require(bytes(p.medicineName).length > 0, "TC: empty medicine name");
        require(p.quantity > 0,                   "TC: zero quantity");
        require(p.expiryDate > block.timestamp,   "TC: expiry in past");

        _tokenCounter++;
        uint256 tid    = _tokenCounter;
        bytes32 qrHash = keccak256(abi.encodePacked(p.qrPayload, tid, msg.sender));

        // Write batch to storage (avoids local Batch variable = 1 less stack slot)
        batches[tid].tokenId           = tid;
        batches[tid].medicineName      = p.medicineName;
        batches[tid].batchNumber       = p.batchNumber;
        batches[tid].genericName       = p.genericName;
        batches[tid].quantity          = p.quantity;
        batches[tid].manufacturedDate  = block.timestamp;
        batches[tid].expiryDate        = p.expiryDate;
        batches[tid].manufacturer      = msg.sender;
        batches[tid].currentHolder     = msg.sender;
        batches[tid].status            = BatchStatus.MANUFACTURED;
        batches[tid].coldChainRequired = p.coldChainRequired;
        batches[tid].minTemp           = p.minTemp;
        batches[tid].maxTemp           = p.maxTemp;
        batches[tid].qrHash            = qrHash;
        batches[tid].ipfsCertificate   = p.ipfsCert;
        batches[tid].isRecalled        = false;

        qrHashToBatch[qrHash] = tid;
        holderBatches[msg.sender].push(tid);
        totalBatches++;

        custodyHistory[tid].push(CustodyRecord({
            from:         address(0),
            to:           msg.sender,
            timestamp:    block.timestamp,
            location:     "Manufacturing Facility",
            recordedTemp: 0,
            notes:        "Batch created"
        }));

        emit BatchMinted(tid, p.batchNumber, p.medicineName, msg.sender, p.quantity);
        return tid;
    }

    // ─── CUSTODY TRANSFER ─────────────────────────────────────────────────────

    /**
     * @dev Transfer custody to next supply chain participant.
     *      Logic split into internal helpers to stay under 16-slot stack limit.
     */
    function transferCustody(
        uint256 _tokenId,
        address _to,
        string  calldata _location,
        int256  _recordedTemp,
        string  calldata _notes
    ) external onlyCurrentHolder(_tokenId) batchExists(_tokenId) notRecalled(_tokenId) {
        require(_to != address(0),   "TC: zero address");
        require(_to != msg.sender,   "TC: self-transfer");

        // Check recipient is registered (getMember returns tuple — read bool at pos [2])
        (, , bool active, , ,) = roleControl.getMember(_to);
        require(active, "TC: recipient not registered");

        // Cold-chain check (inline, uses storage ref — no extra local var)
        if (batches[_tokenId].coldChainRequired) {
            require(
                _recordedTemp >= batches[_tokenId].minTemp &&
                _recordedTemp <= batches[_tokenId].maxTemp,
                "TC: cold-chain temperature violation"
            );
        }

        // Update status via internal helper (keeps this function's stack lean)
        _updateBatchStatus(_tokenId, _to);

        // Record custody via internal helper
        address from = batches[_tokenId].currentHolder;
        batches[_tokenId].currentHolder = _to;
        _removeFromHolder(msg.sender, _tokenId);
        holderBatches[_to].push(_tokenId);

        custodyHistory[_tokenId].push(CustodyRecord({
            from:         from,
            to:           _to,
            timestamp:    block.timestamp,
            location:     _location,
            recordedTemp: _recordedTemp,
            notes:        _notes
        }));

        emit CustodyTransferred(_tokenId, from, _to, _location, block.timestamp);
    }

    /// @dev Internal: update BatchStatus based on recipient role.
    ///      Isolated here so transferCustody stack stays under 16 slots.
    function _updateBatchStatus(uint256 _tokenId, address _to) internal {
        bytes32 role = roleControl.getRole(_to);

        if (role == roleControl.ROLE_SPC() || role == roleControl.ROLE_IMPORTER()) {
            batches[_tokenId].status = BatchStatus.AT_WAREHOUSE;
        } else if (role == roleControl.ROLE_MSD() || role == roleControl.ROLE_WHOLESALER()) {
            batches[_tokenId].status = BatchStatus.IN_TRANSIT;
        } else if (role == roleControl.ROLE_PHARMACY()) {
            batches[_tokenId].status = BatchStatus.AT_PHARMACY;
        } else if (role == roleControl.ROLE_HOSPITAL()) {
            batches[_tokenId].status = BatchStatus.AT_HOSPITAL;
        } else {
            batches[_tokenId].status = BatchStatus.IN_TRANSIT;
        }
    }

    // ─── RECALL ───────────────────────────────────────────────────────────────
    function recallBatch(uint256 _tokenId, string calldata _reason)
        external onlyNMRA batchExists(_tokenId)
    {
        batches[_tokenId].isRecalled = true;
        batches[_tokenId].status     = BatchStatus.RECALLED;
        totalRecalls++;
        emit BatchRecalled(_tokenId, _reason, msg.sender);
    }

    // ─── QR VERIFICATION ──────────────────────────────────────────────────────

    /**
     * @dev Verify a batch by its QR hash. Returns a struct (not 6 bare values)
     *      so the caller's stack is not burdened by multiple return slots.
     *
     * JS call:
     *   const result = await traceability.verifyByQR(qrHash);
     *   console.log(result.isAuthentic);   // true/false
     */
    function verifyByQR(bytes32 _qrHash) external returns (VerifyResult memory result) {
        result.tokenId = qrHashToBatch[_qrHash];

        if (result.tokenId == 0) {
            emit QRVerified(0, msg.sender, false);
            return result; // all fields zero/false/empty
        }

        result.isAuthentic  = !batches[result.tokenId].isRecalled &&
                               batches[result.tokenId].expiryDate > block.timestamp;
        result.medicineName = batches[result.tokenId].medicineName;
        result.batchNumber  = batches[result.tokenId].batchNumber;
        result.status       = batches[result.tokenId].status;
        result.expiryDate   = batches[result.tokenId].expiryDate;

        emit QRVerified(result.tokenId, msg.sender, result.isAuthentic);
    }

    // ─── READ FUNCTIONS ───────────────────────────────────────────────────────
    function getBatch(uint256 _tokenId)
        external view batchExists(_tokenId) returns (Batch memory)
    {
        return batches[_tokenId];
    }

    function getCustodyHistory(uint256 _tokenId)
        external view batchExists(_tokenId) returns (CustodyRecord[] memory)
    {
        return custodyHistory[_tokenId];
    }

    function getHolderBatches(address _holder) external view returns (uint256[] memory) {
        return holderBatches[_holder];
    }

    function getTotalBatches() external view returns (uint256) { return totalBatches; }

    function isBatchExpired(uint256 _tokenId)
        external view batchExists(_tokenId) returns (bool)
    {
        return block.timestamp > batches[_tokenId].expiryDate;
    }

    // ─── INTERNAL ─────────────────────────────────────────────────────────────
    function _removeFromHolder(address _holder, uint256 _tokenId) internal {
        uint256[] storage arr = holderBatches[_holder];
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == _tokenId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }
}
