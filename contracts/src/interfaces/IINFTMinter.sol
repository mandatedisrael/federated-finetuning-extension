// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IINFTMinter — Sealed-key registry for FFE fine-tuned model artifacts
/// @notice After quorum is reached and the aggregator trains the joint LoRA,
///         it calls `mint` once per session. The contract stores the encrypted
///         model blob hash and each contributor's sealedKey so the SDK can
///         recover the symmetric data key and decrypt the artifact.
///
///         One token per session. N sealedKeys per token (one per contributor).
///         Only the designated minter address (the aggregator) can call `mint`.
interface IINFTMinter {
    /* ─────── types ─────── */

    struct MintRecord {
        uint256 sessionId;
        /// @dev 0G Storage Merkle root of the AES-256-GCM-encrypted LoRA artifact.
        bytes32 modelBlobHash;
        address[] contributors;
        uint64 mintedAt;
    }

    /* ─────── events ─────── */

    /// @notice Emitted when the aggregator mints a new INFT for a session.
    event Minted(
        uint256 indexed sessionId,
        uint256 indexed tokenId,
        bytes32 indexed modelBlobHash,
        address[] contributors
    );

    /* ─────── errors ─────── */

    error NotMinter();
    error AlreadyMinted();
    error EmptyContributors();
    error LengthMismatch();
    error ZeroHash();
    error ZeroAddress();
    error EmptySealedKey();
    error TokenNotFound();
    error SessionNotMinted();

    /* ─────── mutations ─────── */

    /// @notice Mint an INFT for a completed session.
    /// @param sessionId       Coordinator session ID.
    /// @param modelBlobHash   0G Storage root hash of the encrypted LoRA.
    /// @param contributors    Ordered list of contributor addresses.
    /// @param sealedKeys      Per-contributor sealed data keys (parallel to contributors).
    ///                        Each entry is the symmetric key encrypted to that contributor's
    ///                        X25519 pubkey using the FFE blob format.
    /// @return tokenId        Monotonically incrementing token identifier (starts at 1).
    function mint(
        uint256 sessionId,
        bytes32 modelBlobHash,
        address[] calldata contributors,
        bytes[] calldata sealedKeys
    ) external returns (uint256 tokenId);

    /* ─────── views ─────── */

    function getMintRecord(uint256 tokenId) external view returns (MintRecord memory);

    /// @notice Returns the sealedKey bytes for a contributor in a given token.
    ///         Returns empty bytes if the address is not a contributor.
    function getSealedKey(uint256 tokenId, address contributor) external view returns (bytes memory);

    /// @notice Returns the tokenId minted for a session. Reverts with SessionNotMinted
    ///         if no token has been minted for this session yet.
    function getTokenBySession(uint256 sessionId) external view returns (uint256 tokenId);

    function hasMinted(uint256 sessionId) external view returns (bool);

    function minter() external view returns (address);

    function nextTokenId() external view returns (uint256);
}
