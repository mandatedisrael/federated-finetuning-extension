// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICoordinator — FFE session lifecycle interface
/// @notice Tracks multi-party fine-tuning sessions on 0G Chain. v0.1 covers
///         only session creation, aggregator pubkey publication, and
///         contributor submissions up to quorum. Staking, slashing, and
///         finalization arrive in later phases.
interface ICoordinator {
    enum Status {
        Open,
        QuorumReached
    }

    struct Session {
        address creator;
        bytes32 baseModel;
        uint8 quorum;
        uint8 submittedCount;
        Status status;
        bytes aggregatorPubkey;
    }

    /* ─────── events ─────── */

    event SessionCreated(
        uint256 indexed sessionId,
        address indexed creator,
        bytes32 indexed baseModel,
        uint8 quorum,
        address[] participants
    );

    event AggregatorPubkeySet(uint256 indexed sessionId, bytes pubkey, bytes attestation);

    event Submitted(uint256 indexed sessionId, address indexed contributor, bytes32 blobHash);

    event QuorumReached(
        uint256 indexed sessionId,
        address[] submitters,
        bytes32[] blobHashes,
        bytes[] ownerPubkeys
    );

    /* ─────── errors ─────── */

    error NotCreator();
    error NotParticipant();
    error AlreadySubmitted();
    error SessionNotFound();
    error SessionNotOpen();
    error AggregatorPubkeyNotSet();
    error AggregatorPubkeyAlreadySet();
    error InvalidQuorum();
    error EmptyParticipants();
    error LengthMismatch();
    error ZeroAddress();
    error ZeroHash();
    error EmptyPubkey();
    error DuplicateParticipant();

    /* ─────── mutations ─────── */

    function createSession(
        bytes32 baseModel,
        address[] calldata _participants,
        bytes[] calldata _ownerPubkeys,
        uint8 _quorum
    ) external returns (uint256 sessionId);

    function setAggregatorPubkey(
        uint256 sessionId,
        bytes calldata pubkey,
        bytes calldata attestation
    ) external;

    function submit(uint256 sessionId, bytes32 blobHash) external;

    /* ─────── views ─────── */

    function nextSessionId() external view returns (uint256);

    function getSession(uint256 sessionId) external view returns (Session memory);

    function getParticipants(uint256 sessionId) external view returns (address[] memory);

    function getSubmitters(uint256 sessionId) external view returns (address[] memory);

    function getSubmission(uint256 sessionId, address contributor) external view returns (bytes32);

    function getOwnerPubkey(uint256 sessionId, address contributor) external view returns (bytes memory);

    function isParticipant(uint256 sessionId, address account) external view returns (bool);
}
