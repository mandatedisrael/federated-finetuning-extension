/**
 * Live integration test for ZeroGStorage.
 *
 * Round-trips real bytes through 0G Storage on Galileo testnet:
 * upload, then download by root hash, then assert bytes-equal.
 *
 * Skipped by default. Requires a funded testnet wallet (storage costs
 * are paid in OG). To run:
 *
 *   FFE_LIVE_STORAGE=1 \
 *   FFE_LIVE_STORAGE_PRIVATE_KEY=0x... \
 *   npm run test:live:storage
 *
 * The wallet is consumed only by the upload step; you can fund a fresh
 * wallet from https://faucet.0g.ai and use a tiny amount.
 *
 * Test wraps a single upload + download since each upload writes to the
 * chain and consumes gas. Don't add more cases here without a strong
 * reason — extend the unit-level coverage in non-live tests instead.
 */
import {describe, expect, it} from "vitest";
import {randomBytes} from "@noble/hashes/utils";
import {ZeroGStorage} from "../../src/storage/index.js";

const LIVE = process.env.FFE_LIVE_STORAGE === "1";
const PRIVATE_KEY = process.env.FFE_LIVE_STORAGE_PRIVATE_KEY;

describe.runIf(LIVE)("ZeroGStorage — live (Galileo)", () => {
    it("requires a funded wallet env var", () => {
        expect(
            PRIVATE_KEY,
            "set FFE_LIVE_STORAGE_PRIVATE_KEY to a funded Galileo wallet",
        ).toBeTruthy();
    });

    it(
        "round-trips arbitrary bytes through upload + download",
        async () => {
            const storage = new ZeroGStorage({privateKey: PRIVATE_KEY!});

            // Use random bytes so each test run produces a unique root hash —
            // avoids any cached / re-used artifacts from prior runs.
            const original = randomBytes(2048);

            const {rootHash, txHash} = await storage.upload(original);
            expect(rootHash).toMatch(/^0x[0-9a-f]{64}$/i);
            expect(txHash).toMatch(/^0x[0-9a-f]{64}$/i);

            // Download via the same client (separately verify the read path
            // works without a signer — see next test).
            const fetched = await storage.download(rootHash);
            expect(fetched.length).toBe(original.length);
            expect(Buffer.from(fetched).equals(Buffer.from(original))).toBe(true);
        },
        // Storage upload + propagation can take a while; budget generously.
        180_000,
    );

    it(
        "download works without a signer (read-only client)",
        async () => {
            // Upload from a signer-bearing client...
            const writer = new ZeroGStorage({privateKey: PRIVATE_KEY!});
            const original = randomBytes(512);
            const {rootHash} = await writer.upload(original);

            // ...then read from a fresh signer-less client.
            const reader = new ZeroGStorage();
            const fetched = await reader.download(rootHash);
            expect(Buffer.from(fetched).equals(Buffer.from(original))).toBe(true);
        },
        180_000,
    );
});

describe.skipIf(LIVE)("ZeroGStorage live tests — skipped (set FFE_LIVE_STORAGE=1 to run)", () => {
    it("placeholder so this file always reports something", () => {
        expect(LIVE).toBe(false);
    });
});
