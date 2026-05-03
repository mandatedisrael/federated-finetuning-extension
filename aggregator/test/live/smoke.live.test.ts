/**
 * E2E smoke test for the full aggregator pipeline on 0G mainnet.
 *
 *   openSession (with aggregator pubkey)
 *   → submit x2 (encrypted, messages format)
 *   → QuorumReached
 *   → aggregate: decrypt blobs → train LoRA → mint INFT
 *   → download + decrypt x2
 *   → verify both contributors get identical bytes
 *
 * REQUIRED ENV VARS:
 *   FFE_LIVE_AGG=1
 *   AGG_EVM_KEY           aggregator wallet private key (0x-prefixed)
 *   AGG_X25519_KEY        aggregator X25519 private key (32-byte hex, no 0x prefix)
 *   COORDINATOR_ADDRESS   0x840C3E83A5f3430079Aff7247CD957c994076015
 *   INFT_ADDRESS          0xEcEd8069b33Ce4F397e4Df1cbb4cDD2fAA038471
 *   FFE_LIVE_WALLET_1     contributor 1 private key (0x-prefixed)
 *   FFE_LIVE_WALLET_2     contributor 2 private key (0x-prefixed)
 *
 * OPTIONAL:
 *   USE_REAL_0G_TRAINING=true   call real 0G fine-tuning service (default: simulation)
 */

import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {FFE, crypto} from "@notmartin/ffe";
import {startOrchestrator} from "../../src/orchestrator";
import {loadConfig} from "../../src/config";

const skipLive = !process.env.FFE_LIVE_AGG;

const COORDINATOR = "0x840C3E83A5f3430079Aff7247CD957c994076015";
const INFT      = "0xEcEd8069b33Ce4F397e4Df1cbb4cDD2fAA038471";
const RPC       = "https://evmrpc.0g.ai";

// Training can take up to 10 min; give the whole pipeline 15 min
const PIPELINE_TIMEOUT_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS    = 15_000;

async function waitForMint(ffe: FFE, sessionId: bigint, timeoutMs: number): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const minted = await ffe.inft.hasMinted(sessionId);
      if (minted) {
        return await ffe.inft.getTokenBySession(sessionId);
      }
    } catch {
      // contract not yet updated — keep polling
    }
    const remaining = Math.round((deadline - Date.now()) / 1000);
    console.log(`[Smoke] Waiting for mint... (${remaining}s remaining)`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`[Smoke] Mint not detected within ${timeoutMs / 1000}s`);
}

describe.skipIf(skipLive)(
  "Aggregator E2E — 0G mainnet",
  {timeout: PIPELINE_TIMEOUT_MS + 120_000},
  () => {
    let sessionId: bigint;
    let tokenId: bigint;
    let kp1: ReturnType<typeof crypto.generateKeyPair>;
    let kp2: ReturnType<typeof crypto.generateKeyPair>;
    let ffe1: FFE;
    let ffe2: FFE;
    let orchestratorStop: (() => void) | null = null;

    beforeAll(async () => {
      const wallet1Key = process.env.FFE_LIVE_WALLET_1 as Hex | undefined;
      const wallet2Key = process.env.FFE_LIVE_WALLET_2 as Hex | undefined;
      const aggX25519Hex = process.env.AGG_X25519_KEY;

      if (!wallet1Key || !wallet2Key) {
        throw new Error("FFE_LIVE_WALLET_1 and FFE_LIVE_WALLET_2 are required");
      }
      if (!aggX25519Hex) {
        throw new Error(
          "AGG_X25519_KEY is required — run `pnpm keygen` in aggregator/ to generate one"
        );
      }

      // Derive aggregator X25519 pubkey from its private key
      const aggPrivKey = new Uint8Array(Buffer.from(aggX25519Hex, "hex"));
      const aggPubKey  = crypto.publicKeyFromPrivate(aggPrivKey);

      const acct1 = privateKeyToAccount(wallet1Key);
      const acct2 = privateKeyToAccount(wallet2Key);
      console.log(`[Smoke] Contributor 1: ${acct1.address}`);
      console.log(`[Smoke] Contributor 2: ${acct2.address}`);

      // Per-contributor X25519 keypairs — used to seal/unseal the LoRA AES key
      kp1 = crypto.generateKeyPair();
      kp2 = crypto.generateKeyPair();

      ffe1 = new FFE({
        privateKey: wallet1Key,
        coordinatorAddress: COORDINATOR as `0x${string}`,
        rpcUrl: RPC,
        storageEvmRpc: RPC,
      });
      ffe2 = new FFE({
        privateKey: wallet2Key,
        coordinatorAddress: COORDINATOR as `0x${string}`,
        rpcUrl: RPC,
        storageEvmRpc: RPC,
      });

      // ── Step 1: create session, set aggregator pubkey inline ──────────────
      // Setting aggregatorPubkey here means contributors can submit immediately
      // without waiting for the aggregator to call setAggregatorPubkey separately.
      console.log("[Smoke] Creating session...");
      const {sessionId: sid} = await ffe1.openSession({
        baseModel: "Qwen2.5-0.5B-Instruct",
        participants: [
          {address: acct1.address, publicKey: kp1.publicKey},
          {address: acct2.address, publicKey: kp2.publicKey},
        ],
        quorum: 2,
        aggregatorPubkey: aggPubKey,
      });
      sessionId = sid;
      console.log(`[Smoke] Session created: ${sessionId}`);

      // ── Step 2: both contributors submit in messages format ───────────────
      // The 0G fine-tuning service requires JSONL with {"messages":[...]} lines.
      const data1 = [
        `{"messages":[{"role":"user","content":"What is FFE?"},{"role":"assistant","content":"FFE is a federated fine-tuning protocol that lets multiple parties jointly train a LoRA without revealing their private data."}]}`,
        `{"messages":[{"role":"user","content":"How does FFE protect my data?"},{"role":"assistant","content":"FFE encrypts your training data to the aggregator TEE public key. Only the enclave can decrypt it."}]}`,
        `{"messages":[{"role":"user","content":"What happens after training?"},{"role":"assistant","content":"The TEE encrypts the trained LoRA, seals the key for each contributor, and mints an INFT on-chain. Each contributor can decrypt independently."}]}`,
      ].join("\n");

      const data2 = [
        `{"messages":[{"role":"user","content":"Who owns the trained model?"},{"role":"assistant","content":"Every contributor receives a sealed copy of the AES key inside an on-chain INFT. Ownership is proportional and verifiable."}]}`,
        `{"messages":[{"role":"user","content":"What blockchain does FFE use?"},{"role":"assistant","content":"FFE runs on 0G Network for contracts, 0G Storage for encrypted blobs, and 0G Compute for TEE fine-tuning."}]}`,
        `{"messages":[{"role":"user","content":"Can a bad contributor be punished?"},{"role":"assistant","content":"Yes. The quality gate scores each contributor's data. Contributors below the threshold have their stake slashed."}]}`,
      ].join("\n");

      console.log("[Smoke] Contributor 1 submitting...");
      const {rootHash: rh1} = await ffe1.submit({
        sessionId,
        data: new TextEncoder().encode(data1),
      });
      console.log(`[Smoke] Contributor 1 blob: ${rh1}`);

      console.log("[Smoke] Contributor 2 submitting...");
      const {rootHash: rh2} = await ffe2.submit({
        sessionId,
        data: new TextEncoder().encode(data2),
      });
      console.log(`[Smoke] Contributor 2 blob: ${rh2}`);

      // ── Step 3: start aggregator ──────────────────────────────────────────
      // loadConfig() reads env vars — AGG_EVM_KEY, AGG_X25519_KEY,
      // COORDINATOR_ADDRESS, INFT_ADDRESS must all be set.
      console.log("[Smoke] Starting aggregator...");
      const config = loadConfig();
      orchestratorStop = startOrchestrator({config});

      // ── Step 4: poll until minted ─────────────────────────────────────────
      console.log("[Smoke] Waiting for pipeline: decrypt → train → mint...");
      tokenId = await waitForMint(ffe1, sessionId, PIPELINE_TIMEOUT_MS);
      console.log(`[Smoke] INFT minted. tokenId=${tokenId}`);
    }, PIPELINE_TIMEOUT_MS + 120_000);

    afterAll(() => {
      orchestratorStop?.();
      console.log("[Smoke] Done.");
    });

    it("session created successfully", () => {
      expect(sessionId).toBeGreaterThanOrEqual(0n);
    });

    it("INFT minted for session", () => {
      expect(tokenId).toBeGreaterThanOrEqual(0n);
    });

    it("contributor 1 can download and decrypt the LoRA", async () => {
      const result = await ffe1.download({
        sessionId,
        recipientPrivateKey: kp1.privateKey,
      });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.tokenId).toBe(tokenId);
      console.log(`[Smoke] Contributor 1 decrypted ${result.data.length} bytes`);
    });

    it("contributor 2 can download and decrypt the LoRA", async () => {
      const result = await ffe2.download({
        sessionId,
        recipientPrivateKey: kp2.privateKey,
      });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.tokenId).toBe(tokenId);
      console.log(`[Smoke] Contributor 2 decrypted ${result.data.length} bytes`);
    });

    it("both contributors decrypt to identical bytes", async () => {
      const r1 = await ffe1.download({sessionId, recipientPrivateKey: kp1.privateKey});
      const r2 = await ffe2.download({sessionId, recipientPrivateKey: kp2.privateKey});
      expect(Buffer.from(r1.data).toString("hex")).toBe(Buffer.from(r2.data).toString("hex"));
      console.log(`[Smoke] ✓ Both contributors hold the same ${r1.data.length}-byte LoRA`);
    });
  }
);
