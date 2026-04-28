// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Coordinator} from "../src/Coordinator.sol";
import {ICoordinator} from "../src/interfaces/ICoordinator.sol";

contract CoordinatorTest is Test {
    Coordinator internal coord;

    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory");

    bytes32 internal constant BASE_MODEL = keccak256("Qwen2.5-0.5B");
    bytes32 internal constant BLOB_A = keccak256("blob-A");
    bytes32 internal constant BLOB_B = keccak256("blob-B");
    bytes32 internal constant BLOB_C = keccak256("blob-C");

    bytes internal constant PK_A = hex"01";
    bytes internal constant PK_B = hex"02";
    bytes internal constant PK_C = hex"03";
    bytes internal constant AGG_PK = hex"deadbeef";
    bytes internal constant ATTESTATION = hex"cafebabe";

    function setUp() public {
        coord = new Coordinator();
    }

    /* ─────── helpers ─────── */

    function _threeParty() internal returns (uint256) {
        address[] memory parts = new address[](3);
        parts[0] = alice;
        parts[1] = bob;
        parts[2] = carol;

        bytes[] memory pks = new bytes[](3);
        pks[0] = PK_A;
        pks[1] = PK_B;
        pks[2] = PK_C;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 3);

        vm.prank(creator);
        coord.setAggregatorPubkey(id, AGG_PK, ATTESTATION);

        return id;
    }

    /* ─────── createSession ─────── */

    function test_createSession_happy() public {
        address[] memory parts = new address[](2);
        parts[0] = alice;
        parts[1] = bob;
        bytes[] memory pks = new bytes[](2);
        pks[0] = PK_A;
        pks[1] = PK_B;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 2);

        assertEq(id, 1);
        assertEq(coord.nextSessionId(), 2);

        ICoordinator.Session memory s = coord.getSession(id);
        assertEq(s.creator, creator);
        assertEq(s.baseModel, BASE_MODEL);
        assertEq(s.quorum, 2);
        assertEq(s.submittedCount, 0);
        assertEq(uint8(s.status), uint8(ICoordinator.Status.Open));
        assertEq(s.aggregatorPubkey.length, 0);

        assertEq(coord.getParticipants(id).length, 2);
        assertTrue(coord.isParticipant(id, alice));
        assertTrue(coord.isParticipant(id, bob));
        assertFalse(coord.isParticipant(id, mallory));
        assertEq(coord.getOwnerPubkey(id, alice), PK_A);
        assertEq(coord.getOwnerPubkey(id, bob), PK_B);
    }

    function test_createSession_revertsOnZeroBaseModel() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.expectRevert(ICoordinator.ZeroHash.selector);
        coord.createSession(bytes32(0), parts, pks, 1);
    }

    function test_createSession_revertsOnEmptyParticipants() public {
        address[] memory parts = new address[](0);
        bytes[] memory pks = new bytes[](0);

        vm.expectRevert(ICoordinator.EmptyParticipants.selector);
        coord.createSession(BASE_MODEL, parts, pks, 1);
    }

    function test_createSession_revertsOnLengthMismatch() public {
        address[] memory parts = new address[](2);
        parts[0] = alice;
        parts[1] = bob;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.expectRevert(ICoordinator.LengthMismatch.selector);
        coord.createSession(BASE_MODEL, parts, pks, 2);
    }

    function test_createSession_revertsOnZeroAddress() public {
        address[] memory parts = new address[](1);
        parts[0] = address(0);
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.expectRevert(ICoordinator.ZeroAddress.selector);
        coord.createSession(BASE_MODEL, parts, pks, 1);
    }

    function test_createSession_revertsOnEmptyPubkey() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = "";

        vm.expectRevert(ICoordinator.EmptyPubkey.selector);
        coord.createSession(BASE_MODEL, parts, pks, 1);
    }

    function test_createSession_revertsOnDuplicateParticipant() public {
        address[] memory parts = new address[](2);
        parts[0] = alice;
        parts[1] = alice;
        bytes[] memory pks = new bytes[](2);
        pks[0] = PK_A;
        pks[1] = PK_B;

        vm.expectRevert(ICoordinator.DuplicateParticipant.selector);
        coord.createSession(BASE_MODEL, parts, pks, 2);
    }

    function test_createSession_revertsOnZeroQuorum() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.expectRevert(ICoordinator.InvalidQuorum.selector);
        coord.createSession(BASE_MODEL, parts, pks, 0);
    }

    function test_createSession_revertsWhenQuorumExceedsParticipants() public {
        address[] memory parts = new address[](2);
        parts[0] = alice;
        parts[1] = bob;
        bytes[] memory pks = new bytes[](2);
        pks[0] = PK_A;
        pks[1] = PK_B;

        vm.expectRevert(ICoordinator.InvalidQuorum.selector);
        coord.createSession(BASE_MODEL, parts, pks, 3);
    }

    function test_createSession_idsIncrement() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.prank(creator);
        uint256 id1 = coord.createSession(BASE_MODEL, parts, pks, 1);

        vm.prank(creator);
        uint256 id2 = coord.createSession(BASE_MODEL, parts, pks, 1);

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    /* ─────── setAggregatorPubkey ─────── */

    function test_setAggregatorPubkey_happy() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 1);

        vm.prank(creator);
        coord.setAggregatorPubkey(id, AGG_PK, ATTESTATION);

        ICoordinator.Session memory s = coord.getSession(id);
        assertEq(s.aggregatorPubkey, AGG_PK);
    }

    function test_setAggregatorPubkey_revertsForNonCreator() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 1);

        vm.prank(mallory);
        vm.expectRevert(ICoordinator.NotCreator.selector);
        coord.setAggregatorPubkey(id, AGG_PK, ATTESTATION);
    }

    function test_setAggregatorPubkey_revertsOnUnknownSession() public {
        vm.expectRevert(ICoordinator.SessionNotFound.selector);
        coord.setAggregatorPubkey(999, AGG_PK, ATTESTATION);
    }

    function test_setAggregatorPubkey_revertsOnEmptyPubkey() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 1);

        vm.prank(creator);
        vm.expectRevert(ICoordinator.EmptyPubkey.selector);
        coord.setAggregatorPubkey(id, "", ATTESTATION);
    }

    function test_setAggregatorPubkey_revertsIfAlreadySet() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 1);

        vm.prank(creator);
        coord.setAggregatorPubkey(id, AGG_PK, ATTESTATION);

        vm.prank(creator);
        vm.expectRevert(ICoordinator.AggregatorPubkeyAlreadySet.selector);
        coord.setAggregatorPubkey(id, AGG_PK, ATTESTATION);
    }

    /* ─────── submit ─────── */

    function test_submit_happy() public {
        uint256 id = _threeParty();

        vm.prank(alice);
        coord.submit(id, BLOB_A);

        assertEq(coord.getSubmission(id, alice), BLOB_A);
        ICoordinator.Session memory s = coord.getSession(id);
        assertEq(s.submittedCount, 1);
        assertEq(uint8(s.status), uint8(ICoordinator.Status.Open));
    }

    function test_submit_revertsForNonParticipant() public {
        uint256 id = _threeParty();

        vm.prank(mallory);
        vm.expectRevert(ICoordinator.NotParticipant.selector);
        coord.submit(id, BLOB_A);
    }

    function test_submit_revertsOnDoubleSubmit() public {
        uint256 id = _threeParty();

        vm.prank(alice);
        coord.submit(id, BLOB_A);

        vm.prank(alice);
        vm.expectRevert(ICoordinator.AlreadySubmitted.selector);
        coord.submit(id, BLOB_A);
    }

    function test_submit_revertsOnZeroBlobHash() public {
        uint256 id = _threeParty();

        vm.prank(alice);
        vm.expectRevert(ICoordinator.ZeroHash.selector);
        coord.submit(id, bytes32(0));
    }

    function test_submit_revertsBeforeAggregatorPubkeySet() public {
        address[] memory parts = new address[](1);
        parts[0] = alice;
        bytes[] memory pks = new bytes[](1);
        pks[0] = PK_A;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 1);

        vm.prank(alice);
        vm.expectRevert(ICoordinator.AggregatorPubkeyNotSet.selector);
        coord.submit(id, BLOB_A);
    }

    function test_submit_revertsOnUnknownSession() public {
        vm.prank(alice);
        vm.expectRevert(ICoordinator.SessionNotFound.selector);
        coord.submit(999, BLOB_A);
    }

    function test_submit_quorumFlipsStatusAndEmits() public {
        uint256 id = _threeParty();

        vm.prank(alice);
        coord.submit(id, BLOB_A);
        vm.prank(bob);
        coord.submit(id, BLOB_B);

        // expect QuorumReached emission on the third submit, with submitters
        // and parallel arrays in submission order
        address[] memory expectSubmitters = new address[](3);
        expectSubmitters[0] = alice;
        expectSubmitters[1] = bob;
        expectSubmitters[2] = carol;

        bytes32[] memory expectBlobs = new bytes32[](3);
        expectBlobs[0] = BLOB_A;
        expectBlobs[1] = BLOB_B;
        expectBlobs[2] = BLOB_C;

        bytes[] memory expectPks = new bytes[](3);
        expectPks[0] = PK_A;
        expectPks[1] = PK_B;
        expectPks[2] = PK_C;

        vm.expectEmit(true, false, false, true);
        emit ICoordinator.QuorumReached(id, expectSubmitters, expectBlobs, expectPks);

        vm.prank(carol);
        coord.submit(id, BLOB_C);

        ICoordinator.Session memory s = coord.getSession(id);
        assertEq(s.submittedCount, 3);
        assertEq(uint8(s.status), uint8(ICoordinator.Status.QuorumReached));
    }

    function test_submit_revertsAfterQuorum() public {
        // partial quorum (2-of-3)
        address[] memory parts = new address[](3);
        parts[0] = alice;
        parts[1] = bob;
        parts[2] = carol;
        bytes[] memory pks = new bytes[](3);
        pks[0] = PK_A;
        pks[1] = PK_B;
        pks[2] = PK_C;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 2);
        vm.prank(creator);
        coord.setAggregatorPubkey(id, AGG_PK, ATTESTATION);

        vm.prank(alice);
        coord.submit(id, BLOB_A);
        vm.prank(bob);
        coord.submit(id, BLOB_B);

        // Carol arrives late — session is already QuorumReached, must revert
        vm.prank(carol);
        vm.expectRevert(ICoordinator.SessionNotOpen.selector);
        coord.submit(id, BLOB_C);
    }

    function test_partialQuorum_emitsOnlySubmitters() public {
        address[] memory parts = new address[](3);
        parts[0] = alice;
        parts[1] = bob;
        parts[2] = carol;
        bytes[] memory pks = new bytes[](3);
        pks[0] = PK_A;
        pks[1] = PK_B;
        pks[2] = PK_C;

        vm.prank(creator);
        uint256 id = coord.createSession(BASE_MODEL, parts, pks, 2);
        vm.prank(creator);
        coord.setAggregatorPubkey(id, AGG_PK, ATTESTATION);

        vm.prank(alice);
        coord.submit(id, BLOB_A);

        address[] memory expectSubmitters = new address[](2);
        expectSubmitters[0] = alice;
        expectSubmitters[1] = bob;
        bytes32[] memory expectBlobs = new bytes32[](2);
        expectBlobs[0] = BLOB_A;
        expectBlobs[1] = BLOB_B;
        bytes[] memory expectPks = new bytes[](2);
        expectPks[0] = PK_A;
        expectPks[1] = PK_B;

        vm.expectEmit(true, false, false, true);
        emit ICoordinator.QuorumReached(id, expectSubmitters, expectBlobs, expectPks);

        vm.prank(bob);
        coord.submit(id, BLOB_B);
    }

    /* ─────── isolation ─────── */

    function test_sessions_areIndependent() public {
        // session 1: alice + bob
        address[] memory parts1 = new address[](2);
        parts1[0] = alice;
        parts1[1] = bob;
        bytes[] memory pks1 = new bytes[](2);
        pks1[0] = PK_A;
        pks1[1] = PK_B;
        vm.prank(creator);
        uint256 id1 = coord.createSession(BASE_MODEL, parts1, pks1, 2);
        vm.prank(creator);
        coord.setAggregatorPubkey(id1, AGG_PK, ATTESTATION);

        // session 2: alice + carol — alice is reused across sessions intentionally
        address[] memory parts2 = new address[](2);
        parts2[0] = alice;
        parts2[1] = carol;
        bytes[] memory pks2 = new bytes[](2);
        pks2[0] = PK_A;
        pks2[1] = PK_C;
        vm.prank(creator);
        uint256 id2 = coord.createSession(BASE_MODEL, parts2, pks2, 2);
        vm.prank(creator);
        coord.setAggregatorPubkey(id2, AGG_PK, ATTESTATION);

        // alice submits to session 1; should NOT count for session 2
        vm.prank(alice);
        coord.submit(id1, BLOB_A);

        assertEq(coord.getSubmission(id1, alice), BLOB_A);
        assertEq(coord.getSubmission(id2, alice), bytes32(0));
        assertFalse(coord.isParticipant(id1, carol));
        assertFalse(coord.isParticipant(id2, bob));
    }
}
