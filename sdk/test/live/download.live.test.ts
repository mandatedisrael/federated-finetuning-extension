/**
 * Live end-to-end test for FFE.download().
 *
 * Simulates the full round-trip a contributor would experience:
 *
 *   1. Open a session and register the contributor's X25519 pubkey.
 *   2. Simulate what the aggregator does after training:
 *        a. Generate a fresh data key K.
 *        b. Encrypt a fake LoRA with K  →  `nonce || ciphertext`.
 *        c. Upload the encrypted LoRA to 0G Storage  →  modelBlobHash.
 *        d. Seal K to the contributor's X25519 pubkey  →  sealedKey bytes.
 *        e. Call INFTMinter.mint(sessionId, modelBlobHash, [contributor], [sealedKey]).
 *   3. Call FFE.download({sessionId, recipientPrivateKey})  →  decrypted bytes.
 *   4. Assert decrypted bytes equal the original fake LoRA.
 *
 * Skipped by default. To run:
 *
 *   FFE_LIVE_DOWNLOAD=1 \
 *   FFE_LIVE_DOWNLOAD_PRIVATE_KEY=0x... \
 *   npm run test:live:download
 *
 * Each run costs ~3 gas transactions (createSession + setAggregatorPubkey +
 * INFTMinter.mint) plus two 0G Storage operations (upload + download).
 *
 * Note: The aggregator-side mint uses the same wallet as the contributor
 * because the INFTMinter's minter address is set to the deployer wallet.
 * In production the TEE aggregator holds the minter key separately.
 */
import {describe, expect, it} from "vitest";
import {bytesToHex, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {FFE} from "../../src/index.js";
import {generateKeyPair, generateAesKey, seal, sealedKeyToBytes} from "../../src/crypto/index.js";
import {aeadEncrypt} from "../../src/crypto/aead.js";

const LIVE = process.env.FFE_LIVE_DOWNLOAD === "1";
const PRIVATE_KEY = process.env.FFE_LIVE_DOWNLOAD_PRIVATE_KEY as Hex | undefined;

const FAKE_LORA = new TextEncoder().encode(
    "FAKE_LORA:" + "x".repeat(200),
);

describe.runIf(LIVE)("FFE.download() — live (Galileo)", () => {
    it("requires a funded wallet env var", () => {
        expect(
            PRIVATE_KEY,
            "set FFE_LIVE_DOWNLOAD_PRIVATE_KEY to a funded Galileo wallet",
        ).toBeTruthy();
    });

    it(
        "full round-trip: simulated aggregator mint → contributor download",
        async () => {
            const ffe = new FFE({privateKey: PRIVATE_KEY!});
            const contributorAddr = ffe.account;

            // Contributor generates their X25519 keypair at session registration time.
            const contributorKey = generateKeyPair();
            const aggKey = generateKeyPair();

            // 1. Open session with the contributor's X25519 pubkey registered.
            const {sessionId} = await ffe.openSession({
                baseModel: "Qwen2.5-0.5B",
                participants: [{address: contributorAddr, publicKey: contributorKey.publicKey}],
                quorum: 1,
                aggregatorPubkey: aggKey.publicKey,
                attestation: new Uint8Array([0xde, 0xad]),
            });

            // 2a. Aggregator: generate data key K.
            const dataKey = generateAesKey();

            // 2b. Encrypt the fake LoRA: nonce(12) || ciphertext.
            const {nonce, ciphertext} = aeadEncrypt(dataKey, FAKE_LORA);
            const encryptedLora = new Uint8Array(nonce.length + ciphertext.length);
            encryptedLora.set(nonce, 0);
            encryptedLora.set(ciphertext, nonce.length);

            // 2c. Upload encrypted LoRA to 0G Storage.
            const upload = await ffe.storage.upload(encryptedLora);
            const modelBlobHash = upload.rootHash;

            // 2d. Seal K to the contributor's X25519 pubkey.
            const sealed = seal(dataKey, contributorKey.publicKey);
            const sealedKeyBytes = sealedKeyToBytes(sealed);

            // 2e. Mint INFT (aggregator calls this; here the same wallet is the minter).
            const mintTxHash = await ffe.inft.mint({
                sessionId,
                modelBlobHash,
                contributors: [contributorAddr],
                sealedKeys: [sealedKeyBytes],
            });
            await ffe.coordinator.publicClient.waitForTransactionReceipt({
                hash: mintTxHash,
                timeout: 120_000,
            });

            // 3. Contributor downloads and decrypts.
            const result = await ffe.download({
                sessionId,
                recipientPrivateKey: contributorKey.privateKey,
            });

            // 4. Verify.
            expect(result.tokenId).toBeGreaterThan(0n);
            expect(result.modelBlobHash.toLowerCase()).toBe(modelBlobHash.toLowerCase());
            expect(result.data).toEqual(FAKE_LORA);

            // Sanity: the contributor's sealed key is on-chain.
            const onChainSealedKey = await ffe.inft.getSealedKey(result.tokenId, contributorAddr);
            expect(onChainSealedKey.toLowerCase()).toBe(
                bytesToHex(sealedKeyBytes).toLowerCase(),
            );
        },
        360_000,
    );
});

describe.skipIf(LIVE)(
    "FFE.download live tests — skipped (set FFE_LIVE_DOWNLOAD=1 to run)",
    () => {
        it("placeholder so this file always reports something", () => {
            expect(LIVE).toBe(false);
        });
    },
);
