import {describe, expect, it} from "vitest";
import {getAbiItem, parseAbi, toEventSelector, toFunctionSelector} from "viem";
import {coordinatorAbi} from "../src/coordinator/abi.js";
import {coordinator} from "../src/index.js";

/**
 * Smoke tests confirming the vendored ABI:
 *  1. Is well-formed (parsed by viem without throwing)
 *  2. Exposes every public surface the SDK relies on
 *  3. Has stable function/event selectors so a contract change forces a
 *     deliberate ABI re-sync rather than silent drift.
 */
describe("coordinator ABI", () => {
    it("is exported through the public namespace", () => {
        expect(coordinator.coordinatorAbi).toBe(coordinatorAbi);
    });

    it("contains the three core mutations", () => {
        for (const fn of ["createSession", "submit", "setAggregatorPubkey"] as const) {
            const item = getAbiItem({abi: coordinatorAbi, name: fn});
            expect(item, `missing function ${fn}`).toBeDefined();
            expect((item as {type: string}).type).toBe("function");
        }
    });

    it("contains every read-side view", () => {
        const views = [
            "nextSessionId",
            "getSession",
            "getParticipants",
            "getSubmitters",
            "getSubmission",
            "getOwnerPubkey",
            "isParticipant",
        ] as const;
        for (const fn of views) {
            const item = getAbiItem({abi: coordinatorAbi, name: fn});
            expect(item, `missing view ${fn}`).toBeDefined();
            expect((item as {stateMutability: string} | undefined)?.stateMutability).toBe("view");
        }
    });

    it("contains every event the off-chain stack listens for", () => {
        const events = ["SessionCreated", "Submitted", "AggregatorPubkeySet", "QuorumReached"] as const;
        for (const ev of events) {
            const item = getAbiItem({abi: coordinatorAbi, name: ev});
            expect(item, `missing event ${ev}`).toBeDefined();
            expect((item as {type: string}).type).toBe("event");
        }
    });

    it("contains every custom error from the contract", () => {
        const errs = [
            "AggregatorPubkeyAlreadySet",
            "AggregatorPubkeyNotSet",
            "AlreadySubmitted",
            "DuplicateParticipant",
            "EmptyParticipants",
            "EmptyPubkey",
            "InvalidQuorum",
            "LengthMismatch",
            "NotCreator",
            "NotParticipant",
            "SessionNotFound",
            "SessionNotOpen",
            "ZeroAddress",
            "ZeroHash",
        ] as const;
        for (const e of errs) {
            const item = getAbiItem({abi: coordinatorAbi, name: e});
            expect(item, `missing error ${e}`).toBeDefined();
            expect((item as {type: string}).type).toBe("error");
        }
    });

    /**
     * Selector pinning. If a function or event signature ever changes (e.g.
     * we rename a parameter type), the selector flips and these break — so
     * the ABI sync becomes a deliberate, reviewed step.
     */
    it("has the expected function selectors", () => {
        const expected = parseAbi([
            "function createSession(bytes32 baseModel, address[] participants_, bytes[] ownerPubkeys_, uint8 quorum_) returns (uint256)",
            "function submit(uint256 sessionId, bytes32 blobHash)",
            "function setAggregatorPubkey(uint256 sessionId, bytes pubkey, bytes attestation)",
        ]);
        for (const fn of expected) {
            if (fn.type !== "function") continue;
            const ours = getAbiItem({abi: coordinatorAbi, name: fn.name});
            expect(ours, `missing ${fn.name}`).toBeDefined();
            expect(toFunctionSelector(ours as never)).toBe(toFunctionSelector(fn));
        }
    });

    it("has the expected event topics", () => {
        const expected = parseAbi([
            "event SessionCreated(uint256 indexed sessionId, address indexed creator, bytes32 indexed baseModel, uint8 quorum, address[] participants)",
            "event Submitted(uint256 indexed sessionId, address indexed contributor, bytes32 blobHash)",
            "event QuorumReached(uint256 indexed sessionId, address[] submitters, bytes32[] blobHashes, bytes[] ownerPubkeys)",
        ]);
        for (const ev of expected) {
            if (ev.type !== "event") continue;
            const ours = getAbiItem({abi: coordinatorAbi, name: ev.name});
            expect(ours, `missing event ${ev.name}`).toBeDefined();
            expect(toEventSelector(ours as never)).toBe(toEventSelector(ev));
        }
    });
});
