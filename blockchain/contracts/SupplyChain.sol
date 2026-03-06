// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SupplyChain {

    /* ===================== ENUMS ===================== */

    // Medicine lifecycle stages
    enum Stage {
        Manufactured,
        InTransit,
        AtDistributor,
        AtPharmacy,
        Sold
    }

    /* ===================== STRUCTS ===================== */

    // Main batch record
    struct Batch {
        uint batchId;
        string name;
        address currentOwner;
        Stage stage;
        uint lastUpdatedTime;
        bool frozen; // regulator recall / freeze
    }

    // Event history record
    struct BatchEvent {
        Stage stage;
        address actor;
        uint timestamp;
        string note;
    }

    /* ===================== STATE VARIABLES ===================== */

    mapping(uint => Batch) public batches;
    mapping(uint => BatchEvent[]) private history;

    address public manufacturer;
    address public distributor;
    address public pharmacy;
    address public regulator;

    uint public constant MIN_TRANSIT_TIME = 5 minutes;

    /* ===================== EVENTS ===================== */

    event BatchRegistered(uint batchId, string name);
    event StageUpdated(uint batchId, Stage stage);
    event Violation(uint batchId, string reason, address actor);
    event BatchFrozen(uint batchId);

    /* ===================== CONSTRUCTOR ===================== */

    constructor(address _distributor, address _pharmacy, address _regulator) {
        manufacturer = msg.sender;
        distributor = _distributor;
        pharmacy = _pharmacy;
        regulator = _regulator;
    }

    /* ===================== MODIFIERS ===================== */

    modifier onlyManufacturer() {
        require(msg.sender == manufacturer, "Only Manufacturer allowed");
        _;
    }

    modifier onlyDistributor() {
        require(msg.sender == distributor, "Only Distributor allowed");
        _;
    }

    modifier onlyPharmacy() {
        require(msg.sender == pharmacy, "Only Pharmacy allowed");
        _;
    }

    modifier onlyRegulator() {
        require(msg.sender == regulator, "Only Regulator allowed");
        _;
    }

    modifier notFrozen(uint batchId) {
        require(!batches[batchId].frozen, "Batch frozen by regulator");
        _;
    }

    /* ===================== INTERNAL RULES ===================== */

    // Valid supply chain order enforcement
    function isValidTransition(Stage from, Stage to) internal pure returns (bool) {
        if (from == Stage.Manufactured && to == Stage.InTransit) return true;
        if (from == Stage.InTransit && to == Stage.AtDistributor) return true;
        if (from == Stage.AtDistributor && to == Stage.AtPharmacy) return true;
        if (from == Stage.AtPharmacy && to == Stage.Sold) return true;
        return false;
    }

    /* ===================== CORE FUNCTIONS ===================== */

    // Register medicine batch (Manufacturer only)
    function registerBatch(uint batchId, string memory name)
        public
        onlyManufacturer
    {
        require(batches[batchId].batchId == 0, "Batch already exists");

        batches[batchId] = Batch(
            batchId,
            name,
            msg.sender,
            Stage.Manufactured,
            block.timestamp,
            false
        );

        history[batchId].push(
            BatchEvent(Stage.Manufactured, msg.sender, block.timestamp, "Batch Registered")
        );

        emit BatchRegistered(batchId, name);
    }

    // Update stage with rule checks
    function updateStage(uint batchId, Stage newStage, string memory note)
        public
        notFrozen(batchId)
    {
        Batch storage b = batches[batchId];
        require(b.batchId != 0, "Batch not found");

        // Role enforcement
        if (newStage == Stage.InTransit)
            require(msg.sender == manufacturer, "Invalid actor");
        else if (newStage == Stage.AtDistributor)
            require(msg.sender == distributor, "Invalid actor");
        else if (newStage == Stage.AtPharmacy)
            require(msg.sender == pharmacy, "Invalid actor");
        else if (newStage == Stage.Sold)
            require(msg.sender == pharmacy, "Invalid actor");

        // Supply chain order rule
        require(
            isValidTransition(b.stage, newStage),
            "Invalid supply chain order"
        );

        // Time-based anomaly rule
        require(
            block.timestamp - b.lastUpdatedTime >= MIN_TRANSIT_TIME,
            "Suspicious fast movement"
        );

        // Update state
        b.stage = newStage;
        b.currentOwner = msg.sender;
        b.lastUpdatedTime = block.timestamp;

        history[batchId].push(
            BatchEvent(newStage, msg.sender, block.timestamp, note)
        );

        emit StageUpdated(batchId, newStage);
    }

    /* ===================== REGULATOR FUNCTIONS ===================== */

    // Freeze / recall unsafe batch
    function freezeBatch(uint batchId) public onlyRegulator {
        batches[batchId].frozen = true;
        emit BatchFrozen(batchId);
    }

    /* ===================== VIEW FUNCTIONS ===================== */

    function getBatch(uint batchId)
        public
        view
        returns (string memory, address, Stage, bool)
    {
        Batch memory b = batches[batchId];
        return (b.name, b.currentOwner, b.stage, b.frozen);
    }

    function getHistoryCount(uint batchId) public view returns (uint) {
        return history[batchId].length;
    }

    function getHistory(uint batchId, uint index)
        public
        view
        returns (Stage, address, uint, string memory)
    {
        BatchEvent memory e = history[batchId][index];
        return (e.stage, e.actor, e.timestamp, e.note);
    }
}
