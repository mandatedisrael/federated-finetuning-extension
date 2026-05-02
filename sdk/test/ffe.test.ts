/**
 * Deterministic tests for the FFE entry point.
 *
 * Covers construction, input validation, and baseModel normalization. The
 * on-chain portion of `openSession` (createSession + setAggregatorPubkey
 * + event decoding) is exercised in test/live/ffe.live.test.ts.
 */
import {describe, expect, it} from "vitest";
import {bytesToHex, getAddress, keccak256, stringToBytes, type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {FFE, InvalidInputError} from "../src/index.js";
import {normalizeBaseModel, validateOpenSession, validateSubmit} from "../src/ffe.js";

const PRIVATE_KEY = ("0x" + "ab".repeat(32)) as Hex;
const ALICE: Address = getAddress("0x000000000000000000000000000000000000a11c");
const BOB: Address = getAddress("0x000000000000000000000000000000000000b0b0");
const PK_A: Hex = "0x11";
const PK_B: Hex = "0x22";

describe("FFE construction", () => {
    it("derives the wallet address from the provided private key", () => {
        const ffe = new FFE({privateKey: PRIVATE_KEY});
        const expected = privateKeyToAccount(PRIVATE_KEY).address;
        expect(ffe.account).toBe(expected);
    });

    it("exposes underlying coordinator and storage clients", () => {
        const ffe = new FFE({privateKey: PRIVATE_KEY});
        expect(ffe.coordinator).toBeDefined();
        expect(ffe.storage).toBeDefined();
    });
});

describe("normalizeBaseModel", () => {
    it("hashes a label string with keccak256", () => {
        const label = "Qwen2.5-0.5B";
        expect(normalizeBaseModel(label)).toBe(keccak256(stringToBytes(label)));
    });

    it("returns a 32-byte hex string as-is, lowercased", () => {
        const upper = ("0x" + "AB".repeat(32)) as Hex;
        expect(normalizeBaseModel(upper)).toBe("0x" + "ab".repeat(32));
    });

    it("converts a 32-byte Uint8Array to hex", () => {
        const bytes = new Uint8Array(32).fill(0xab);
        expect(normalizeBaseModel(bytes)).toBe(bytesToHex(bytes));
    });

    it("rejects a Uint8Array of the wrong length", () => {
        expect(() => normalizeBaseModel(new Uint8Array(31))).toThrow(InvalidInputError);
    });

    it("rejects an empty string", () => {
        expect(() => normalizeBaseModel("")).toThrow(InvalidInputError);
    });

    it("treats a non-32-byte hex-looking string as a label and hashes it", () => {
        // Short hex string — not a 32-byte hash. Should be hashed as a label.
        const result = normalizeBaseModel("0xdead");
        expect(result).toBe(keccak256(stringToBytes("0xdead")));
    });
});

describe("validateOpenSession", () => {
    const validParticipants = [
        {address: ALICE, publicKey: PK_A},
        {address: BOB, publicKey: PK_B},
    ];

    it("accepts a well-formed config", () => {
        expect(() =>
            validateOpenSession({
                baseModel: "Qwen2.5-0.5B",
                participants: validParticipants,
                quorum: 2,
            }),
        ).not.toThrow();
    });

    it("rejects empty participants", () => {
        expect(() =>
            validateOpenSession({baseModel: "x", participants: [], quorum: 1}),
        ).toThrow(InvalidInputError);
    });

    it("rejects quorum below 1", () => {
        expect(() =>
            validateOpenSession({baseModel: "x", participants: validParticipants, quorum: 0}),
        ).toThrow(InvalidInputError);
    });

    it("rejects quorum above participant count", () => {
        expect(() =>
            validateOpenSession({baseModel: "x", participants: validParticipants, quorum: 3}),
        ).toThrow(InvalidInputError);
    });

    it("rejects non-integer quorum", () => {
        expect(() =>
            validateOpenSession({baseModel: "x", participants: validParticipants, quorum: 1.5}),
        ).toThrow(InvalidInputError);
    });

    it("rejects duplicate participants (case-insensitive)", () => {
        expect(() =>
            validateOpenSession({
                baseModel: "x",
                participants: [
                    {address: ALICE, publicKey: PK_A},
                    {address: ALICE.toLowerCase() as Address, publicKey: PK_B},
                ],
                quorum: 2,
            }),
        ).toThrow(InvalidInputError);
    });

    it("rejects empty publicKey (Uint8Array)", () => {
        expect(() =>
            validateOpenSession({
                baseModel: "x",
                participants: [{address: ALICE, publicKey: new Uint8Array(0)}],
                quorum: 1,
            }),
        ).toThrow(InvalidInputError);
    });

    it("rejects empty publicKey (hex)", () => {
        expect(() =>
            validateOpenSession({
                baseModel: "x",
                participants: [{address: ALICE, publicKey: "0x"}],
                quorum: 1,
            }),
        ).toThrow(InvalidInputError);
    });

    it("rejects attestation without aggregatorPubkey", () => {
        expect(() =>
            validateOpenSession({
                baseModel: "x",
                participants: validParticipants,
                quorum: 2,
                attestation: new Uint8Array([1, 2, 3]),
            }),
        ).toThrow(InvalidInputError);
    });

    it("rejects more than 255 participants (uint8 quorum cap)", () => {
        const huge = Array.from({length: 256}, (_, i) => ({
            address: getAddress(`0x${(i + 1).toString(16).padStart(40, "0")}`),
            publicKey: PK_A,
        }));
        expect(() =>
            validateOpenSession({baseModel: "x", participants: huge, quorum: 1}),
        ).toThrow(InvalidInputError);
    });
});

describe("validateSubmit", () => {
    it("accepts valid input", () => {
        expect(() =>
            validateSubmit({sessionId: 1n, data: new Uint8Array([1, 2, 3])}),
        ).not.toThrow();
    });

    it("rejects negative sessionId", () => {
        expect(() =>
            validateSubmit({sessionId: -1n, data: new Uint8Array([1])}),
        ).toThrow(InvalidInputError);
    });

    it("rejects non-bigint sessionId", () => {
        expect(() =>
            // @ts-expect-error — intentional wrong type
            validateSubmit({sessionId: 1, data: new Uint8Array([1])}),
        ).toThrow(InvalidInputError);
    });

    it("rejects empty data", () => {
        expect(() =>
            validateSubmit({sessionId: 0n, data: new Uint8Array(0)}),
        ).toThrow(InvalidInputError);
    });

    it("rejects non-Uint8Array data", () => {
        expect(() =>
            // @ts-expect-error — intentional wrong type
            validateSubmit({sessionId: 0n, data: "jsonl string"}),
        ).toThrow(InvalidInputError);
    });

    it("accepts sessionId of 0n", () => {
        expect(() =>
            validateSubmit({sessionId: 0n, data: new Uint8Array([0xff])}),
        ).not.toThrow();
    });
});
