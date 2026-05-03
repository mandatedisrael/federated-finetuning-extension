/**
 * Live integration test for FFE.openSession().
 *
 * Calls createSession + setAggregatorPubkey on the deployed Coordinator
 * at 0x840C3E83A5f3430079Aff7247CD957c994076015 on Galileo testnet.
 *
 * Skipped by default. To run:
 *
 *   FFE_LIVE_OPEN=1 \
 *   FFE_LIVE_OPEN_PRIVATE_KEY=0x... \
 *   npm run test:live:open
 *
 * Each run costs ~2 createSession-sized transactions of gas. The test
 * uses a fresh random keypair for each session's participant slot so
 * we never collide with prior state.
 */
import {describe, expect, it} from "vitest";
import {keccak256, stringToBytes, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {generateKeyPair} from "../../src/crypto/index.js";
import {FFE} from "../../src/index.js";
import {SessionStatus} from "../../src/coordinator/index.js";

const LIVE = process.env.FFE_LIVE_OPEN === "1";
const PRIVATE_KEY = process.env.FFE_LIVE_OPEN_PRIVATE_KEY as Hex | undefined;

describe.runIf(LIVE)("FFE.openSession() — live (Galileo)", () => {
    it("requires a funded wallet env var", () => {
        expect(
            PRIVATE_KEY,
            "set FFE_LIVE_OPEN_PRIVATE_KEY to a funded Galileo wallet",
        ).toBeTruthy();
    });

    it(
        "creates a session and reads it back",
        async () => {
            const ffe = new FFE({privateKey: PRIVATE_KEY!});

            // Single-participant session — the simplest valid shape.
            const participantKey = generateKeyPair();
            const participantAddr = ffe.account; // creator IS the participant for this test

            const result = await ffe.openSession({
                baseModel: "Qwen2.5-0.5B",
                participants: [{address: participantAddr, publicKey: participantKey.publicKey}],
                quorum: 1,
            });

            expect(result.sessionId).toBeGreaterThan(0n);
            expect(result.createTxHash).toMatch(/^0x[0-9a-f]{64}$/i);
            expect(result.setAggregatorTxHash).toBeUndefined();

            // Read it back via the lower-level coordinator client.
            const session = await ffe.coordinator.getSession(result.sessionId);
            expect(session.creator.toLowerCase()).toBe(ffe.account.toLowerCase());
            expect(session.baseModel).toBe(keccak256(stringToBytes("Qwen2.5-0.5B")));
            expect(session.quorum).toBe(1);
            expect(session.submittedCount).toBe(0);
            expect(session.status).toBe(SessionStatus.Open);
            expect(session.aggregatorPubkey).toBe("0x");

            // Whitelist matches.
            const participants = await ffe.coordinator.getParticipants(result.sessionId);
            expect(participants).toEqual([participantAddr]);
            expect(await ffe.coordinator.isParticipant(result.sessionId, participantAddr)).toBe(true);
        },
        180_000,
    );

    it(
        "creates a session and sets aggregator pubkey in one shot",
        async () => {
            const ffe = new FFE({privateKey: PRIVATE_KEY!});

            const participantKey = generateKeyPair();
            const aggKey = generateKeyPair();

            const result = await ffe.openSession({
                baseModel: "Qwen2.5-0.5B",
                participants: [{address: ffe.account, publicKey: participantKey.publicKey}],
                quorum: 1,
                aggregatorPubkey: aggKey.publicKey,
                attestation: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
            });

            expect(result.setAggregatorTxHash).toMatch(/^0x[0-9a-f]{64}$/i);

            // Pubkey is now on-chain.
            const session = await ffe.coordinator.getSession(result.sessionId);
            expect(session.aggregatorPubkey.toLowerCase()).toBe(
                ("0x" + Buffer.from(aggKey.publicKey).toString("hex")).toLowerCase(),
            );
        },
        240_000,
    );
});

describe.skipIf(LIVE)("FFE.openSession live tests — skipped (set FFE_LIVE_OPEN=1 to run)", () => {
    it("placeholder so this file always reports something", () => {
        expect(LIVE).toBe(false);
    });
});
