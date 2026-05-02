// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {INFTMinter} from "../src/INFTMinter.sol";
import {IINFTMinter} from "../src/interfaces/IINFTMinter.sol";

contract INFTMinterTest is Test {
    INFTMinter internal inft;

    address internal aggregator = makeAddr("aggregator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory");

    bytes32 internal constant MODEL_HASH = keccak256("lora-v1-encrypted");
    uint256 internal constant SESSION_1 = 1;
    uint256 internal constant SESSION_2 = 2;

    bytes internal constant SK_A = hex"aabbcc";
    bytes internal constant SK_B = hex"ddeeff";
    bytes internal constant SK_C = hex"112233";

    function setUp() public {
        inft = new INFTMinter(aggregator);
    }

    /* ─────── helpers ─────── */

    function _threeContributors()
        internal
        pure
        returns (address[] memory parts, bytes[] memory keys)
    {
        parts = new address[](3);
        parts[0] = address(0x000000000000000000000000000000000000a11c);
        parts[1] = address(0x000000000000000000000000000000000000b0b0);
        parts[2] = address(0x000000000000000000000000000000000000ca01);

        keys = new bytes[](3);
        keys[0] = hex"aabbcc";
        keys[1] = hex"ddeeff";
        keys[2] = hex"112233";
    }

    /* ─────── constructor ─────── */

    function test_constructor_setsMinter() public view {
        assertEq(inft.minter(), aggregator);
    }

    function test_constructor_revertsOnZeroMinter() public {
        vm.expectRevert("INFTMinter: zero minter");
        new INFTMinter(address(0));
    }

    /* ─────── mint — happy path ─────── */

    function test_mint_happy_single() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(aggregator);
        uint256 tokenId = inft.mint(SESSION_1, MODEL_HASH, parts, keys);

        assertEq(tokenId, 1);
        assertEq(inft.nextTokenId(), 2);
        assertTrue(inft.hasMinted(SESSION_1));
        assertEq(inft.getTokenBySession(SESSION_1), 1);

        IINFTMinter.MintRecord memory rec = inft.getMintRecord(tokenId);
        assertEq(rec.sessionId, SESSION_1);
        assertEq(rec.modelBlobHash, MODEL_HASH);
        assertEq(rec.contributors.length, 1);
        assertEq(rec.contributors[0], alice);
        assertGt(rec.mintedAt, 0);

        assertEq(inft.getSealedKey(tokenId, alice), SK_A);
    }

    function test_mint_happy_three() public {
        (address[] memory parts, bytes[] memory keys) = _threeContributors();

        vm.prank(aggregator);
        uint256 tokenId = inft.mint(SESSION_1, MODEL_HASH, parts, keys);

        assertEq(tokenId, 1);

        // Each contributor can read their own sealedKey.
        assertEq(inft.getSealedKey(tokenId, parts[0]), keys[0]);
        assertEq(inft.getSealedKey(tokenId, parts[1]), keys[1]);
        assertEq(inft.getSealedKey(tokenId, parts[2]), keys[2]);
    }

    function test_mint_tokenIds_increment() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(aggregator);
        uint256 id1 = inft.mint(SESSION_1, MODEL_HASH, parts, keys);

        parts[0] = bob;
        vm.prank(aggregator);
        uint256 id2 = inft.mint(SESSION_2, MODEL_HASH, parts, keys);

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_mint_emitsEvent() public {
        address[] memory parts = new address[](2);
        parts[0] = alice;
        parts[1] = bob;
        bytes[] memory keys = new bytes[](2);
        keys[0] = SK_A;
        keys[1] = SK_B;

        vm.expectEmit(true, true, true, true);
        emit IINFTMinter.Minted(SESSION_1, 1, MODEL_HASH, parts);

        vm.prank(aggregator);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);
    }

    /* ─────── mint — reverts ─────── */

    function test_mint_revertsForNonMinter() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(mallory);
        vm.expectRevert(IINFTMinter.NotMinter.selector);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);
    }

    function test_mint_revertsOnDoubleMint() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(aggregator);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);

        vm.prank(aggregator);
        vm.expectRevert(IINFTMinter.AlreadyMinted.selector);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);
    }

    function test_mint_revertsOnZeroModelHash() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(aggregator);
        vm.expectRevert(IINFTMinter.ZeroHash.selector);
        inft.mint(SESSION_1, bytes32(0), parts, keys);
    }

    function test_mint_revertsOnEmptyContributors() public {
        address[] memory parts = new address[](0);
        bytes[] memory keys = new bytes[](0);

        vm.prank(aggregator);
        vm.expectRevert(IINFTMinter.EmptyContributors.selector);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);
    }

    function test_mint_revertsOnLengthMismatch() public {
        address[] memory parts = new address[](2);
        parts[0] = alice;
        parts[1] = bob;
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(aggregator);
        vm.expectRevert(IINFTMinter.LengthMismatch.selector);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);
    }

    function test_mint_revertsOnZeroContributorAddress() public {
        address[] memory parts = new address[](1);
        parts[0] = address(0);
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(aggregator);
        vm.expectRevert(IINFTMinter.ZeroAddress.selector);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);
    }

    function test_mint_revertsOnEmptySealedKey() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory keys = new bytes[](1);
        keys[0] = "";

        vm.prank(aggregator);
        vm.expectRevert(IINFTMinter.EmptySealedKey.selector);
        inft.mint(SESSION_1, MODEL_HASH, parts, keys);
    }

    /* ─────── views ─────── */

    function test_getMintRecord_revertsOnUnknownToken() public {
        vm.expectRevert(IINFTMinter.TokenNotFound.selector);
        inft.getMintRecord(999);
    }

    function test_getTokenBySession_revertsIfNotMinted() public {
        vm.expectRevert(IINFTMinter.SessionNotMinted.selector);
        inft.getTokenBySession(SESSION_1);
    }

    function test_getSealedKey_returnsEmptyForNonContributor() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory keys = new bytes[](1);
        keys[0] = SK_A;

        vm.prank(aggregator);
        uint256 tokenId = inft.mint(SESSION_1, MODEL_HASH, parts, keys);

        // mallory was not a contributor — empty bytes, not a revert
        assertEq(inft.getSealedKey(tokenId, mallory).length, 0);
    }

    function test_hasMinted_falseBeforeMint() public view {
        assertFalse(inft.hasMinted(SESSION_1));
    }

    /* ─────── isolation ─────── */

    function test_sessions_areIndependent() public {
        address[] memory parts1 = new address[](1);
        parts1[0] = alice;
        bytes[] memory keys1 = new bytes[](1);
        keys1[0] = SK_A;

        address[] memory parts2 = new address[](1);
        parts2[0] = bob;
        bytes[] memory keys2 = new bytes[](1);
        keys2[0] = SK_B;

        vm.prank(aggregator);
        uint256 tok1 = inft.mint(SESSION_1, MODEL_HASH, parts1, keys1);

        vm.prank(aggregator);
        uint256 tok2 = inft.mint(SESSION_2, MODEL_HASH, parts2, keys2);

        // Alice's key only lives in token 1; Bob's only in token 2.
        assertEq(inft.getSealedKey(tok1, alice), SK_A);
        assertEq(inft.getSealedKey(tok1, bob).length, 0);
        assertEq(inft.getSealedKey(tok2, bob), SK_B);
        assertEq(inft.getSealedKey(tok2, alice).length, 0);
    }
}
