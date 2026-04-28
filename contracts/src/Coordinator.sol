// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICoordinator} from "./interfaces/ICoordinator.sol";

/// @title Coordinator — FFE session lifecycle on 0G Chain (v0.1)
/// @notice Tracks who is in a session, the encrypted dataset hash each
///         contributor submitted, and the aggregator's enclave pubkey.
///         Emits QuorumReached with everything an off-chain aggregator
///         needs to fetch, decrypt, and train.
/// @dev    Pure storage-and-events. No staking, slashing, or finalization
///         in v0.1; those arrive with the TEE plumbing in later phases.
contract Coordinator is ICoordinator {
    /* ─────── storage ─────── */

    uint256 private _nextSessionId = 1;

    mapping(uint256 => Session) private _sessions;
    mapping(uint256 => address[]) private _participants;
    mapping(uint256 => address[]) private _submitters;
    /// @dev Empty pubkey ⇒ not a participant. Saves one mapping vs. tracking
    ///      whitelist separately.
    mapping(uint256 => mapping(address => bytes)) private _ownerPubkeys;
    /// @dev Zero hash ⇒ not yet submitted. Submissions enforce non-zero.
    mapping(uint256 => mapping(address => bytes32)) private _submissions;

    /* ─────── mutations ─────── */

    /// @inheritdoc ICoordinator
    function createSession(
        bytes32 baseModel,
        address[] calldata participants_,
        bytes[] calldata ownerPubkeys_,
        uint8 quorum_
    ) external returns (uint256 sessionId) {
        if (baseModel == bytes32(0)) revert ZeroHash();
        if (participants_.length == 0) revert EmptyParticipants();
        if (participants_.length != ownerPubkeys_.length) revert LengthMismatch();
        if (participants_.length > type(uint8).max) revert InvalidQuorum();
        if (quorum_ == 0 || quorum_ > participants_.length) revert InvalidQuorum();

        sessionId = _nextSessionId++;

        Session storage s = _sessions[sessionId];
        s.creator = msg.sender;
        s.baseModel = baseModel;
        s.quorum = quorum_;
        // submittedCount and status default to 0/Open.

        for (uint256 i = 0; i < participants_.length; i++) {
            address p = participants_[i];
            bytes calldata pk = ownerPubkeys_[i];

            if (p == address(0)) revert ZeroAddress();
            if (pk.length == 0) revert EmptyPubkey();
            if (_ownerPubkeys[sessionId][p].length != 0) revert DuplicateParticipant();

            _ownerPubkeys[sessionId][p] = pk;
            _participants[sessionId].push(p);
        }

        emit SessionCreated(sessionId, msg.sender, baseModel, quorum_, participants_);
    }

    /// @inheritdoc ICoordinator
    function setAggregatorPubkey(
        uint256 sessionId,
        bytes calldata pubkey,
        bytes calldata attestation
    ) external {
        Session storage s = _sessions[sessionId];
        if (s.creator == address(0)) revert SessionNotFound();
        if (msg.sender != s.creator) revert NotCreator();
        if (s.status != Status.Open) revert SessionNotOpen();
        if (s.aggregatorPubkey.length != 0) revert AggregatorPubkeyAlreadySet();
        if (pubkey.length == 0) revert EmptyPubkey();

        s.aggregatorPubkey = pubkey;

        emit AggregatorPubkeySet(sessionId, pubkey, attestation);
    }

    /// @inheritdoc ICoordinator
    function submit(uint256 sessionId, bytes32 blobHash) external {
        Session storage s = _sessions[sessionId];
        if (s.creator == address(0)) revert SessionNotFound();
        if (s.status != Status.Open) revert SessionNotOpen();
        if (s.aggregatorPubkey.length == 0) revert AggregatorPubkeyNotSet();
        if (blobHash == bytes32(0)) revert ZeroHash();
        if (_ownerPubkeys[sessionId][msg.sender].length == 0) revert NotParticipant();
        if (_submissions[sessionId][msg.sender] != bytes32(0)) revert AlreadySubmitted();

        _submissions[sessionId][msg.sender] = blobHash;
        _submitters[sessionId].push(msg.sender);
        unchecked {
            s.submittedCount += 1;
        }

        emit Submitted(sessionId, msg.sender, blobHash);

        if (s.submittedCount == s.quorum) {
            s.status = Status.QuorumReached;
            _emitQuorumReached(sessionId);
        }
    }

    /* ─────── views ─────── */

    function nextSessionId() external view returns (uint256) {
        return _nextSessionId;
    }

    function getSession(uint256 sessionId) external view returns (Session memory) {
        Session memory s = _sessions[sessionId];
        if (s.creator == address(0)) revert SessionNotFound();
        return s;
    }

    function getParticipants(uint256 sessionId) external view returns (address[] memory) {
        if (_sessions[sessionId].creator == address(0)) revert SessionNotFound();
        return _participants[sessionId];
    }

    function getSubmitters(uint256 sessionId) external view returns (address[] memory) {
        if (_sessions[sessionId].creator == address(0)) revert SessionNotFound();
        return _submitters[sessionId];
    }

    function getSubmission(uint256 sessionId, address contributor) external view returns (bytes32) {
        return _submissions[sessionId][contributor];
    }

    function getOwnerPubkey(uint256 sessionId, address contributor) external view returns (bytes memory) {
        return _ownerPubkeys[sessionId][contributor];
    }

    function isParticipant(uint256 sessionId, address account) external view returns (bool) {
        return _ownerPubkeys[sessionId][account].length != 0;
    }

    /* ─────── internal ─────── */

    function _emitQuorumReached(uint256 sessionId) private {
        address[] memory submitters = _submitters[sessionId];
        bytes32[] memory blobHashes = new bytes32[](submitters.length);
        bytes[] memory ownerPubkeys_ = new bytes[](submitters.length);

        for (uint256 i = 0; i < submitters.length; i++) {
            address sub = submitters[i];
            blobHashes[i] = _submissions[sessionId][sub];
            ownerPubkeys_[i] = _ownerPubkeys[sessionId][sub];
        }

        emit QuorumReached(sessionId, submitters, blobHashes, ownerPubkeys_);
    }
}
