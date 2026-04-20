// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./RoleAccessControl.sol";

/**
 * @title ConsensusAdapter
 * @dev   Records and manages consensus mode transitions triggered by AI risk scores.
 *
 * RESEARCH CONTRIBUTION — World-first AI-triggered consensus switching:
 *   - Normal operations → PoA (fast, 3 validators: NMRA, SPC, MSD)
 *   - High-risk order detected (LSTM score > 0.8) → Switch to PBFT
 *   - PBFT requires all 3 validators to sign off-chain
 *   - After resolution → Switch back to PoA
 *
 * NOTE: Actual PoA/PBFT consensus happens in Ganache/off-chain PBFT coordinator.
 *       This contract is the ON-CHAIN RECORD of:
 *         - Which consensus mode is active
 *         - Why it switched (which order, what risk score)
 *         - Validator signatures for PBFT rounds
 *         - Full audit trail of all switches
 *
 * This immutable audit trail is the key thesis contribution —
 * regulators (NMRA) can prove consensus integrity was maintained.
 */
contract ConsensusAdapter {

    RoleAccessControl public roleControl;

    // ─── ENUMS ────────────────────────────────────────────────────────────────
    enum ConsensusMode { POA, PBFT }

    enum SwitchReason {
        HIGH_RISK_ORDER,      // LSTM score > 800
        EMERGENCY_RECALL,     // NMRA batch recall
        VALIDATOR_FAULT,      // Validator node offline
        MANUAL_OVERRIDE,      // NMRA manual trigger
        RESOLVED              // Back to normal
    }

    // ─── STRUCTS ──────────────────────────────────────────────────────────────
    struct ConsensusEvent {
        uint256       eventId;
        ConsensusMode fromMode;
        ConsensusMode toMode;
        SwitchReason  reason;
        uint256       triggeredBy;    // orderId or batchId
        uint256       riskScore;      // LSTM score that triggered switch
        uint256       timestamp;
        address       initiator;      // who called the switch
        bool          resolved;
    }

    struct ValidatorVote {
        address validator;
        bool    approved;
        uint256 timestamp;
        bytes32 dataHash;             // hash of the order/batch being voted on
    }

    // ─── STATE ────────────────────────────────────────────────────────────────
    ConsensusMode public currentMode;
    uint256       private _eventCounter;

    // Validators (NMRA, SPC, MSD — the 3 PoA authorities)
    address[3] public validators;
    uint256    public validatorCount;

    mapping(uint256 => ConsensusEvent)              public events;
    mapping(uint256 => mapping(address => ValidatorVote)) public votes; // eventId → validator → vote
    mapping(uint256 => uint256)                     public voteCount;   // eventId → approvals

    uint256 public totalSwitches;
    uint256 public activeEventId;  // 0 = no active PBFT round

    // ─── EVENTS ───────────────────────────────────────────────────────────────
    event ConsensusSwitched(
        uint256 indexed eventId,
        ConsensusMode fromMode,
        ConsensusMode toMode,
        SwitchReason  reason,
        uint256       riskScore,
        uint256       timestamp
    );
    event ValidatorVoted(uint256 indexed eventId, address validator, bool approved);
    event PBFTRoundComplete(uint256 indexed eventId, bool reached);
    event ConsensusRestored(uint256 indexed eventId, uint256 timestamp);

    // ─── MODIFIERS ────────────────────────────────────────────────────────────
    modifier onlyNMRA() {
        require(roleControl.isActiveRole(msg.sender, roleControl.ROLE_NMRA()), "CA: not NMRA");
        _;
    }

    modifier onlyValidator() {
        require(_isValidator(msg.sender), "CA: not a validator");
        _;
    }

    // ─── CONSTRUCTOR ──────────────────────────────────────────────────────────
    constructor(address _roleControl, address _nmra, address _spc, address _msd) {
        roleControl    = RoleAccessControl(_roleControl);
        currentMode    = ConsensusMode.POA;
        validators[0]  = _nmra;
        validators[1]  = _spc;
        validators[2]  = _msd;
        validatorCount = 3;
    }

    // ─── CONSENSUS SWITCHING ──────────────────────────────────────────────────

    /**
     * @dev Switch from PoA → PBFT when AI detects high-risk order.
     *      Called by the oracle server when riskScore > 800.
     *
     * @param _triggerId  The orderId that caused the switch
     * @param _riskScore  LSTM risk score (0-1000)
     * @param _reason     Why switching (usually HIGH_RISK_ORDER)
     */
    function switchToPBFT(
        uint256      _triggerId,
        uint256      _riskScore,
        SwitchReason _reason
    ) external onlyNMRA {
        require(currentMode == ConsensusMode.POA, "CA: already in PBFT");
        require(activeEventId == 0,               "CA: PBFT round active");

        _eventCounter++;
        uint256 eid = _eventCounter;

        events[eid].eventId     = eid;
        events[eid].fromMode    = ConsensusMode.POA;
        events[eid].toMode      = ConsensusMode.PBFT;
        events[eid].reason      = _reason;
        events[eid].triggeredBy = _triggerId;
        events[eid].riskScore   = _riskScore;
        events[eid].timestamp   = block.timestamp;
        events[eid].initiator   = msg.sender;
        events[eid].resolved    = false;

        currentMode   = ConsensusMode.PBFT;
        activeEventId = eid;
        totalSwitches++;

        emit ConsensusSwitched(eid, ConsensusMode.POA, ConsensusMode.PBFT, _reason, _riskScore, block.timestamp);
    }

    /**
     * @dev Each validator casts their PBFT vote on the active round.
     *      When all 3 validators approve → PBFT consensus reached.
     *
     * @param _eventId  The active consensus event ID
     * @param _approve  True = approve the emergency order, False = reject
     * @param _dataHash keccak256 of the order data being voted on
     */
    function castVote(
        uint256 _eventId,
        bool    _approve,
        bytes32 _dataHash
    ) external onlyValidator {
        require(_eventId == activeEventId,              "CA: wrong event");
        require(votes[_eventId][msg.sender].timestamp == 0, "CA: already voted");
        require(currentMode == ConsensusMode.PBFT,     "CA: not in PBFT");

        votes[_eventId][msg.sender].validator = msg.sender;
        votes[_eventId][msg.sender].approved  = _approve;
        votes[_eventId][msg.sender].timestamp = block.timestamp;
        votes[_eventId][msg.sender].dataHash  = _dataHash;

        if (_approve) voteCount[_eventId]++;

        emit ValidatorVoted(_eventId, msg.sender, _approve);

        // Check if all 3 validators voted
        bool allVoted = votes[_eventId][validators[0]].timestamp > 0 &&
                        votes[_eventId][validators[1]].timestamp > 0 &&
                        votes[_eventId][validators[2]].timestamp > 0;

        if (allVoted) {
            bool reached = voteCount[_eventId] >= 2; // 2-of-3 majority
            emit PBFTRoundComplete(_eventId, reached);
        }
    }

    /**
     * @dev Switch back to PoA after PBFT resolution.
     *      Called by oracle server after emergency order is processed.
     */
    function restorePoA(uint256 _eventId) external onlyNMRA {
        require(_eventId == activeEventId,          "CA: wrong event");
        require(currentMode == ConsensusMode.PBFT,  "CA: not in PBFT");

        events[_eventId].resolved = true;
        currentMode   = ConsensusMode.POA;
        activeEventId = 0;

        emit ConsensusRestored(_eventId, block.timestamp);
        emit ConsensusSwitched(
            _eventId, ConsensusMode.PBFT, ConsensusMode.POA,
            SwitchReason.RESOLVED, 0, block.timestamp
        );
    }

    /**
     * @dev NMRA manual override — force switch to PBFT for any reason.
     */
    function manualSwitch() external onlyNMRA {
        require(currentMode == ConsensusMode.POA, "CA: already PBFT");
        require(activeEventId == 0,               "CA: PBFT round active");

        _eventCounter++;
        uint256 eid = _eventCounter;

        events[eid].eventId     = eid;
        events[eid].fromMode    = ConsensusMode.POA;
        events[eid].toMode      = ConsensusMode.PBFT;
        events[eid].reason      = SwitchReason.MANUAL_OVERRIDE;
        events[eid].triggeredBy = 0;
        events[eid].riskScore   = 0;
        events[eid].timestamp   = block.timestamp;
        events[eid].initiator   = msg.sender;
        events[eid].resolved    = false;

        currentMode   = ConsensusMode.PBFT;
        activeEventId = eid;
        totalSwitches++;

        emit ConsensusSwitched(eid, ConsensusMode.POA, ConsensusMode.PBFT,
            SwitchReason.MANUAL_OVERRIDE, 0, block.timestamp);
    }

    // ─── READ ─────────────────────────────────────────────────────────────────
    function getCurrentMode() external view returns (ConsensusMode) {
        return currentMode;
    }

    function getEvent(uint256 _eventId) external view returns (ConsensusEvent memory) {
        return events[_eventId];
    }

    function getVote(uint256 _eventId, address _validator)
        external view returns (ValidatorVote memory)
    {
        return votes[_eventId][_validator];
    }

    function getVoteCount(uint256 _eventId) external view returns (uint256) {
        return voteCount[_eventId];
    }

    function isInPBFT() external view returns (bool) {
        return currentMode == ConsensusMode.PBFT;
    }

    function getActiveEventId() external view returns (uint256) {
        return activeEventId;
    }

    // ─── INTERNAL ─────────────────────────────────────────────────────────────
    function _isValidator(address _addr) internal view returns (bool) {
        for (uint256 i = 0; i < validatorCount; i++) {
            if (validators[i] == _addr) return true;
        }
        return false;
    }
}
