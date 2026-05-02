/**
 * Live end-to-end test for FFE.submit().
 *
 * Opens a session, sets aggregator pubkey, encrypts sample JSONL, uploads
 * to 0G Storage, submits on-chain, and verifies via getSubmission.
 *
 * Skipped by default. To run:
 *
 *   FFE_LIVE_SUBMIT=1 \
 *   FFE_LIVE_SUBMIT_PRIVATE_KEY=0x... \
 *   npm run test:live:submit
 *
 * Each run costs ~3 transactions of gas (createSession + setAggregatorPubkey
 * + submit) plus one 0G Storage upload.
 */
import {describe, expect, it} from "vitest";
import {type Hex} from "viem";
import {generateKeyPair} from "../../src/crypto/index.js";
import {FFE} from "../../src/index.js";

const LIVE = process.env.FFE_LIVE_SUBMIT === "1";
const PRIVATE_KEY = process.env.FFE_LIVE_SUBMIT_PRIVATE_KEY as Hex | undefined;

const SAMPLE_JSONL = new TextEncoder().encode(
    [
        JSON.stringify({instruction: "What is 2+2?", output: "4"}),
        JSON.stringify({instruction: "Capital of France?", output: "Paris"}),
    ].join("\n"),
);

describe.runIf(LIVE)("FFE.submit() — live (Galileo)", () => {
    it("requires a funded wallet env var", () => {
        expect(
            PRIVATE_KEY,
            "set FFE_LIVE_SUBMIT_PRIVATE_KEY to a funded Galileo wallet",
        ).toBeTruthy();
    });

    it(
        "encrypts, uploads, and submits sample JSONL — verifies on-chain",
        async () => {
            const ffe = new FFE({privateKey: PRIVATE_KEY!});

            // Fresh keypairs for this run — participant and aggregator.
            const participantKey = generateKeyPair();
            const aggKey = generateKeyPair();

            // Open session with aggregator pubkey set in one shot.
            const {sessionId} = await ffe.openSession({
                baseModel: "Qwen2.5-0.5B",
                participants: [{address: ffe.account, publicKey: participantKey.publicKey}],
                quorum: 1,
                aggregatorPubkey: aggKey.publicKey,
                attestation: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
            });

            expect(sessionId).toBeGreaterThan(0n);

            // Submit sample JSONL.
            const result = await ffe.submit({sessionId, data: SAMPLE_JSONL});

            expect(result.rootHash).toMatch(/^0x[0-9a-f]+$/i);
            expect(result.storageTxHash).toMatch(/^0x[0-9a-f]{64}$/i);
            expect(result.submitTxHash).toMatch(/^0x[0-9a-f]{64}$/i);

            // On-chain: getSubmission returns the rootHash we committed.
            const onChainHash = await ffe.coordinator.getSubmission(sessionId, ffe.account);
            expect(onChainHash.toLowerCase()).toBe(result.rootHash.toLowerCase());

            // Submitter is now recorded.
            const submitters = await ffe.coordinator.getSubmitters(sessionId);
            expect(submitters.map((s) => s.toLowerCase())).toContain(ffe.account.toLowerCase());
        },
        300_000,
    );
});

describe.skipIf(LIVE)("FFE.submit live tests — skipped (set FFE_LIVE_SUBMIT=1 to run)", () => {
    it("placeholder so this file always reports something", () => {
        expect(LIVE).toBe(false);
    });
});
