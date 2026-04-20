// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./RoleAccessControl.sol";

/**
 * @title OrderingContract  (stack-safe version)
 * @dev   Manages pharmaceutical procurement orders.
 *
 * Stack discipline:
 *   - placeOrder writes directly to storage (no Order{} literal = no 17-slot burst)
 *   - All functions keep local vars ≤ 4
 *   - No function exceeds 16 total stack slots
 */
contract OrderingContract {

    RoleAccessControl public roleControl;

    // ─── ENUMS ────────────────────────────────────────────────────────────────
    enum OrderStatus {
        PENDING,       // 0
        AI_REVIEW,     // 1
        APPROVED,      // 2
        EMERGENCY,     // 3
        FULFILLED,     // 4
        REJECTED,      // 5
        CANCELLED      // 6
    }

    enum ApprovalPath { STANDARD, EMERGENCY }

    // ─── STRUCTS ──────────────────────────────────────────────────────────────
    struct Order {
        uint256      orderId;
        address      placer;
        address      supplier;
        string       medicineName;
        string       genericName;
        uint256      quantity;
        uint256      unitPriceWei;
        uint256      totalValueWei;
        OrderStatus  status;
        ApprovalPath path;
        uint256      riskScore;
        string       urgencyReason;
        uint256      placedAt;
        uint256      processedAt;
        address      approvedBy;
        string       rejectionReason;
        bool         isPaid;
    }

    // ─── STATE ────────────────────────────────────────────────────────────────
    uint256 private  _orderCounter;
    address public   aiOracleAddress;

    mapping(uint256 => Order)     public orders;
    mapping(address => uint256[]) public ordersBy;
    mapping(address => uint256[]) public ordersFor;

    uint256 public totalOrders;
    uint256 public totalFulfilled;
    uint256 public totalEmergencyOrders;

    uint256 public constant EMERGENCY_THRESHOLD = 800;

    // ─── EVENTS ───────────────────────────────────────────────────────────────
    event OrderPlaced(uint256 indexed orderId, address indexed placer,
                      address indexed supplier, string medicineName, uint256 quantity);
    event RiskScoreSet(uint256 indexed orderId, uint256 riskScore, ApprovalPath path);
    event OrderApproved(uint256 indexed orderId, address approvedBy, ApprovalPath path);
    event OrderEmergency(uint256 indexed orderId, uint256 riskScore);
    event OrderFulfilled(uint256 indexed orderId, address fulfilledBy);
    event OrderRejected(uint256 indexed orderId, address rejectedBy, string reason);
    event OrderCancelled(uint256 indexed orderId, address cancelledBy);

    // ─── MODIFIERS ────────────────────────────────────────────────────────────
    modifier onlyNMRA() {
        require(roleControl.isActiveRole(msg.sender, roleControl.ROLE_NMRA()), "OC: not NMRA");
        _;
    }

    modifier onlyPharmacyOrHospital() {
        require(
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_PHARMACY()) ||
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_HOSPITAL()),
            "OC: must be PHARMACY or HOSPITAL"
        );
        _;
    }

    modifier onlySPCorMSD() {
        require(
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_SPC()) ||
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_MSD()),
            "OC: must be SPC or MSD"
        );
        _;
    }

    modifier orderExists(uint256 _id) {
        require(_id > 0 && _id <= _orderCounter, "OC: order not found");
        _;
    }

    modifier inStatus(uint256 _id, OrderStatus _s) {
        require(orders[_id].status == _s, "OC: wrong status");
        _;
    }

    // ─── CONSTRUCTOR ──────────────────────────────────────────────────────────
    constructor(address _roleControl, address _aiOracle) {
        roleControl     = RoleAccessControl(_roleControl);
        aiOracleAddress = _aiOracle;
    }

    // ─── ADMIN ────────────────────────────────────────────────────────────────
    function setAIOracle(address _oracle) external onlyNMRA {
        require(_oracle != address(0), "OC: zero address");
        aiOracleAddress = _oracle;
    }

    // ─── PLACE ORDER ──────────────────────────────────────────────────────────

    /**
     * @dev Pharmacy or Hospital places an order.
     *
     * Stack discipline: writes directly to storage instead of using
     * an Order{} struct literal — struct literals put ALL fields on the
     * stack simultaneously which overflows the 16-slot limit.
     *
     * JS call:
     *   await ordering.connect(pharmacy).placeOrder(
     *     spc.address, "Panadol 500mg", "Paracetamol 500mg",
     *     10000, ethers.parseEther("0.0001"), "Regular procurement"
     *   );
     */
    function placeOrder(
        address _supplier,
        string  calldata _medicineName,
        string  calldata _genericName,
        uint256 _quantity,
        uint256 _unitPriceWei,
        string  calldata _urgencyReason
    ) external onlyPharmacyOrHospital returns (uint256) {
        require(_supplier != address(0), "OC: zero supplier");
        (, , bool active, , ,) = roleControl.getMember(_supplier);
        require(active,      "OC: supplier not registered");
        require(_quantity > 0, "OC: zero quantity");

        _orderCounter++;
        uint256 oid = _orderCounter;  // only 1 local var needed

        // Write each field directly to storage — avoids struct literal stack burst
        orders[oid].orderId        = oid;
        orders[oid].placer         = msg.sender;
        orders[oid].supplier       = _supplier;
        orders[oid].medicineName   = _medicineName;
        orders[oid].genericName    = _genericName;
        orders[oid].quantity       = _quantity;
        orders[oid].unitPriceWei   = _unitPriceWei;
        orders[oid].totalValueWei  = _quantity * _unitPriceWei;
        orders[oid].status         = OrderStatus.AI_REVIEW;
        orders[oid].path           = ApprovalPath.STANDARD;
        orders[oid].riskScore      = 0;
        orders[oid].urgencyReason  = _urgencyReason;
        orders[oid].placedAt       = block.timestamp;
        orders[oid].processedAt    = 0;
        orders[oid].approvedBy     = address(0);
        orders[oid].rejectionReason = "";
        orders[oid].isPaid         = false;

        ordersBy[msg.sender].push(oid);
        ordersFor[_supplier].push(oid);
        totalOrders++;

        emit OrderPlaced(oid, msg.sender, _supplier, _medicineName, _quantity);
        return oid;
    }

    // ─── AI RISK SCORE ────────────────────────────────────────────────────────

    /**
     * @dev AI oracle sets the risk score (0–1000, where 1000 = risk 1.0).
     *      Score > 800 → EMERGENCY path (PBFT), else STANDARD (PoA).
     *      For demo: NMRA account can also call this.
     */
    function setRiskScore(uint256 _oid, uint256 _score)
        external
        orderExists(_oid)
        inStatus(_oid, OrderStatus.AI_REVIEW)
    {
        require(
            msg.sender == aiOracleAddress ||
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_NMRA()),
            "OC: not oracle or NMRA"
        );
        require(_score <= 1000, "OC: score > 1000");

        orders[_oid].riskScore = _score;

        if (_score > EMERGENCY_THRESHOLD) {
            orders[_oid].status = OrderStatus.EMERGENCY;
            orders[_oid].path   = ApprovalPath.EMERGENCY;
            totalEmergencyOrders++;
            emit OrderEmergency(_oid, _score);
        } else {
            orders[_oid].status = OrderStatus.PENDING;
        }

        emit RiskScoreSet(_oid, _score, orders[_oid].path);
    }

    // ─── APPROVAL ─────────────────────────────────────────────────────────────

    /// @dev SPC or MSD approves a standard (low-risk) order.
    function approveOrder(uint256 _oid)
        external
        onlySPCorMSD
        orderExists(_oid)
        inStatus(_oid, OrderStatus.PENDING)
    {
        require(orders[_oid].supplier == msg.sender, "OC: not supplier");
        orders[_oid].status      = OrderStatus.APPROVED;
        orders[_oid].approvedBy  = msg.sender;
        orders[_oid].processedAt = block.timestamp;
        emit OrderApproved(_oid, msg.sender, ApprovalPath.STANDARD);
    }

    /// @dev NMRA approves an emergency order (after PBFT consensus off-chain).
    function approveEmergencyOrder(uint256 _oid)
        external
        onlyNMRA
        orderExists(_oid)
        inStatus(_oid, OrderStatus.EMERGENCY)
    {
        orders[_oid].status      = OrderStatus.APPROVED;
        orders[_oid].approvedBy  = msg.sender;
        orders[_oid].processedAt = block.timestamp;
        emit OrderApproved(_oid, msg.sender, ApprovalPath.EMERGENCY);
    }

    /// @dev SPC/MSD or NMRA rejects an order.
    function rejectOrder(uint256 _oid, string calldata _reason)
        external
        orderExists(_oid)
    {
        require(
            orders[_oid].status == OrderStatus.PENDING ||
            orders[_oid].status == OrderStatus.EMERGENCY,
            "OC: cannot reject"
        );
        require(
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_SPC())   ||
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_MSD())   ||
            roleControl.isActiveRole(msg.sender, roleControl.ROLE_NMRA()),
            "OC: not authorised"
        );
        orders[_oid].status          = OrderStatus.REJECTED;
        orders[_oid].rejectionReason = _reason;
        orders[_oid].processedAt     = block.timestamp;
        emit OrderRejected(_oid, msg.sender, _reason);
    }

    // ─── FULFILLMENT ──────────────────────────────────────────────────────────

    /// @dev SPC or MSD marks order fulfilled (goods dispatched).
    function fulfillOrder(uint256 _oid)
        external
        onlySPCorMSD
        orderExists(_oid)
        inStatus(_oid, OrderStatus.APPROVED)
    {
        require(orders[_oid].supplier == msg.sender, "OC: not supplier");
        orders[_oid].status      = OrderStatus.FULFILLED;
        orders[_oid].processedAt = block.timestamp;
        totalFulfilled++;
        emit OrderFulfilled(_oid, msg.sender);
    }

    // ─── CANCEL ───────────────────────────────────────────────────────────────
    function cancelOrder(uint256 _oid) external orderExists(_oid) {
        require(orders[_oid].placer == msg.sender, "OC: not placer");
        require(
            orders[_oid].status == OrderStatus.PENDING ||
            orders[_oid].status == OrderStatus.AI_REVIEW,
            "OC: cannot cancel"
        );
        orders[_oid].status = OrderStatus.CANCELLED;
        emit OrderCancelled(_oid, msg.sender);
    }

    // ─── READ ─────────────────────────────────────────────────────────────────
    function getOrder(uint256 _oid) external view orderExists(_oid) returns (Order memory) {
        return orders[_oid];
    }

    function getOrdersByPlacer(address _p) external view returns (uint256[] memory) {
        return ordersBy[_p];
    }

    function getOrdersForSupplier(address _s) external view returns (uint256[] memory) {
        return ordersFor[_s];
    }

    function getStats() external view returns (uint256, uint256, uint256) {
        return (totalOrders, totalFulfilled, totalEmergencyOrders);
    }
}
