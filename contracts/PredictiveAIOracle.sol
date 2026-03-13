// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./RoleAccessControl.sol";

/**
 * @title PredictiveAIOracle
 * @dev   On-chain oracle that receives LSTM risk predictions from the
 *        off-chain Python model and stores them for the OrderingContract.
 *
 * FLOW:
 *   Python LSTM model → HTTP POST → pbft_coordinator/oracle_server.js
 *   → oracle_server.js calls submitPrediction() on this contract
 *   → OrderingContract reads getRiskScore() before routing order
 *
 * PREDICTIONS STORED:
 *   - Stock depletion risk (0-1000)
 *   - Demand forecast (units/week)
 *   - Cold chain risk (0-1000)
 *   - Counterfeit risk (0-1000)
 *   - Overall risk score (0-1000) — used by OrderingContract
 */
contract PredictiveAIOracle {

    RoleAccessControl public roleControl;

    // ─── STRUCTS ──────────────────────────────────────────────────────────────
    struct Prediction {
        string  medicineName;
        uint256 stockDepletionRisk;   // 0-1000
        uint256 demandForecast;       // units per week
        uint256 coldChainRisk;        // 0-1000
        uint256 counterfeitRisk;      // 0-1000
        uint256 overallRisk;          // 0-1000 — used by OrderingContract
        uint256 timestamp;
        bool    isValid;
    }

    // ─── STATE ────────────────────────────────────────────────────────────────
    address public oracleOperator;   // authorised off-chain oracle address

    // medicineName (lowercase) → latest prediction
    mapping(string => Prediction) public predictions;
    // orderId → risk score (set when order is evaluated)
    mapping(uint256 => uint256)   public orderRiskScores;

    string[] public trackedMedicines;
    uint256  public totalPredictions;

    // ─── EVENTS ───────────────────────────────────────────────────────────────
    event PredictionSubmitted(
        string  medicineName,
        uint256 overallRisk,
        uint256 stockDepletionRisk,
        uint256 demandForecast,
        uint256 timestamp
    );
    event OrderEvaluated(uint256 indexed orderId, string medicineName, uint256 riskScore);
    event OracleOperatorUpdated(address newOperator);

    // ─── MODIFIERS ────────────────────────────────────────────────────────────
    modifier onlyNMRA() {
        require(roleControl.isActiveRole(msg.sender, roleControl.ROLE_NMRA()), "Oracle: not NMRA");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracleOperator, "Oracle: not authorised operator");
        _;
    }

    // ─── CONSTRUCTOR ──────────────────────────────────────────────────────────
    constructor(address _roleControl, address _oracleOperator) {
        roleControl     = RoleAccessControl(_roleControl);
        oracleOperator  = _oracleOperator;
    }

    // ─── ORACLE ADMIN ─────────────────────────────────────────────────────────
    function setOracleOperator(address _operator) external onlyNMRA {
        require(_operator != address(0), "Oracle: zero address");
        oracleOperator = _operator;
        emit OracleOperatorUpdated(_operator);
    }

    // ─── SUBMIT PREDICTION ────────────────────────────────────────────────────

    /**
     * @dev Called by the off-chain oracle server after LSTM model runs.
     *      All risk values are 0-1000 (multiply float by 1000).
     *      e.g. risk = 0.87 → submit 870
     *
     * @param _medicine          Medicine name (lowercase, e.g. "paracetamol")
     * @param _stockRisk         Predicted stock depletion risk (0-1000)
     * @param _demandForecast    Predicted weekly demand in units
     * @param _coldChainRisk     Cold chain failure risk (0-1000)
     * @param _counterfeitRisk   Counterfeit detection risk (0-1000)
     * @param _overallRisk       Combined LSTM output risk (0-1000)
     */
    function submitPrediction(
        string  calldata _medicine,
        uint256 _stockRisk,
        uint256 _demandForecast,
        uint256 _coldChainRisk,
        uint256 _counterfeitRisk,
        uint256 _overallRisk
    ) external onlyOracle {
        require(bytes(_medicine).length > 0, "Oracle: empty medicine name");
        require(_overallRisk <= 1000,        "Oracle: risk > 1000");

        bool isNew = !predictions[_medicine].isValid;

        predictions[_medicine].medicineName       = _medicine;
        predictions[_medicine].stockDepletionRisk = _stockRisk;
        predictions[_medicine].demandForecast     = _demandForecast;
        predictions[_medicine].coldChainRisk      = _coldChainRisk;
        predictions[_medicine].counterfeitRisk    = _counterfeitRisk;
        predictions[_medicine].overallRisk        = _overallRisk;
        predictions[_medicine].timestamp          = block.timestamp;
        predictions[_medicine].isValid            = true;

        if (isNew) trackedMedicines.push(_medicine);
        totalPredictions++;

        emit PredictionSubmitted(_medicine, _overallRisk, _stockRisk, _demandForecast, block.timestamp);
    }

    /**
     * @dev Evaluate an order's risk score based on medicine name.
     *      Called by the oracle server when a new order is placed.
     *      Stores score so OrderingContract can read it.
     */
    function evaluateOrder(
        uint256 _orderId,
        string  calldata _medicine
    ) external onlyOracle {
        uint256 risk = 0;
        if (predictions[_medicine].isValid) {
            risk = predictions[_medicine].overallRisk;
        }
        orderRiskScores[_orderId] = risk;
        emit OrderEvaluated(_orderId, _medicine, risk);
    }

    // ─── READ ─────────────────────────────────────────────────────────────────
    function getPrediction(string calldata _medicine)
        external view returns (Prediction memory)
    {
        return predictions[_medicine];
    }

    function getRiskScore(string calldata _medicine)
        external view returns (uint256)
    {
        return predictions[_medicine].overallRisk;
    }

    function getOrderRisk(uint256 _orderId)
        external view returns (uint256)
    {
        return orderRiskScores[_orderId];
    }

    function getTrackedMedicines() external view returns (string[] memory) {
        return trackedMedicines;
    }

    function isStale(string calldata _medicine, uint256 _maxAgeSeconds)
        external view returns (bool)
    {
        if (!predictions[_medicine].isValid) return true;
        return block.timestamp - predictions[_medicine].timestamp > _maxAgeSeconds;
    }
}
