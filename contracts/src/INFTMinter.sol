// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IINFTMinter} from "./interfaces/IINFTMinter.sol";

/// @title INFTMinter — Sealed-key registry for FFE fine-tuned model artifacts
/// @notice Stores one INFT record per completed fine-tuning session. The
///         aggregator (TEE) calls `mint` once after training, supplying the
///         encrypted LoRA blob hash and N sealedKeys — one per contributor.
///         Each contributor reads their sealedKey via `getSealedKey`, fetches
///         the encrypted LoRA from 0G Storage, and decrypts it locally.
///
/// @dev    No ERC-721 dependency — this is a purpose-built sealed-key
///         registry. Token IDs are opaque monotonic counters. Access control
///         is a single immutable minter address set at deploy time.
contract INFTMinter is IINFTMinter {
    /* ─────── storage ─────── */

    address private immutable _minter;
    uint256 private _nextTokenId = 1;

    mapping(uint256 => MintRecord) private _records;
    /// @dev tokenId => contributor => sealedKey bytes
    mapping(uint256 => mapping(address => bytes)) private _sealedKeys;
    /// @dev sessionId => tokenId (0 means not yet minted)
    mapping(uint256 => uint256) private _sessionToToken;

    /* ─────── constructor ─────── */

    constructor(address minter_) {
        require(minter_ != address(0), "INFTMinter: zero minter");
        _minter = minter_;
    }

    /* ─────── mutations ─────── */

    /// @inheritdoc IINFTMinter
    function mint(
        uint256 sessionId,
        bytes32 modelBlobHash,
        address[] calldata contributors,
        bytes[] calldata sealedKeys
    ) external returns (uint256 tokenId) {
        if (msg.sender != _minter) revert NotMinter();
        if (_sessionToToken[sessionId] != 0) revert AlreadyMinted();
        if (modelBlobHash == bytes32(0)) revert ZeroHash();
        if (contributors.length == 0) revert EmptyContributors();
        if (contributors.length != sealedKeys.length) revert LengthMismatch();

        for (uint256 i = 0; i < contributors.length; i++) {
            if (contributors[i] == address(0)) revert ZeroAddress();
            if (sealedKeys[i].length == 0) revert EmptySealedKey();
        }

        tokenId = _nextTokenId++;

        _records[tokenId] = MintRecord({
            sessionId: sessionId,
            modelBlobHash: modelBlobHash,
            contributors: contributors,
            mintedAt: uint64(block.timestamp)
        });

        for (uint256 i = 0; i < contributors.length; i++) {
            _sealedKeys[tokenId][contributors[i]] = sealedKeys[i];
        }

        _sessionToToken[sessionId] = tokenId;

        emit Minted(sessionId, tokenId, modelBlobHash, contributors);
    }

    /* ─────── views ─────── */

    /// @inheritdoc IINFTMinter
    function getMintRecord(uint256 tokenId) external view returns (MintRecord memory) {
        if (_records[tokenId].mintedAt == 0) revert TokenNotFound();
        return _records[tokenId];
    }

    /// @inheritdoc IINFTMinter
    function getSealedKey(uint256 tokenId, address contributor) external view returns (bytes memory) {
        return _sealedKeys[tokenId][contributor];
    }

    /// @inheritdoc IINFTMinter
    function getTokenBySession(uint256 sessionId) external view returns (uint256 tokenId) {
        tokenId = _sessionToToken[sessionId];
        if (tokenId == 0) revert SessionNotMinted();
    }

    /// @inheritdoc IINFTMinter
    function hasMinted(uint256 sessionId) external view returns (bool) {
        return _sessionToToken[sessionId] != 0;
    }

    /// @inheritdoc IINFTMinter
    function minter() external view returns (address) {
        return _minter;
    }

    /// @inheritdoc IINFTMinter
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
