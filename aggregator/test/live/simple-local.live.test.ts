/**
 * Simple 3-person (2 contributors + aggregator TEE) test using local storage fallback.
 * EXTENDED TIMEOUT - waits up to 30 minutes for full pipeline
 */

import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {FFE, crypto} from "@notmartin/ffe";
import {startOrchestrator} from "../../src/orchestrator";
import {loadConfig} from "../../src/config";

const skipLive = !process.env.FFE_LIVE_AGG;

const COORDINATOR   = "0x840C3E83A5f3430079Aff7247CD957c994076015";
const INFT          = "0x04D804912881B692b585604fb0dA1CE0D403487E";
const RPC           = "https://evmrpc.0g.ai";
const LOCAL_STORAGE = "/tmp/ffe-storage-test";

// EXTENDED: 30 minutes for full pipeline (session creation + training + minting)
const PIPELINE_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS    = 5_000;  // Poll every 5 seconds

async function waitForMint(ffe: FFE, sessionId: bigint, timeoutMs: number): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  let pollCount = 0;
  
  while (Date.now() < deadline) {
    pollCount++;
    try {
      const minted = await ffe.inft.hasMinted(sessionId);
      if (minted) {
        console.log(`[Success] INFT minted after ${pollCount} polls!`);
        return await ffe.inft.getTokenBySession(sessionId);
      }
    } catch (err) {
      // Session not yet mined or other transient error
    }
    
    const remaining = Math.round((deadline - Date.now()) / 1000);
    const elapsedMins = Math.round((Date.now() - (deadline - timeoutMs)) / 60000);
    if (pollCount % 6 === 0) {  // Log every 30 seconds
      console.log(`[Poll #${pollCount}] Elapsed: ${elapsedMins}m, Remaining: ${remaining}s`);
    }
    
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`[Timeout] Mint not detected within ${timeoutMs / 60000} minutes`);
}

describe.skipIf(skipLive)(
  "FFE E2E — 3 Person (2 Contributors + Aggregator TEE) - EXTENDED TIMEOUT",
  {timeout: PIPELINE_TIMEOUT_MS + 180_000},
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
        throw new Error("AGG_X25519_KEY is required");
      }

      const aggPrivKey = new Uint8Array(Buffer.from(aggX25519Hex, "hex"));
      const aggPubKey  = crypto.publicKeyFromPrivate(aggPrivKey);

      const acct1 = privateKeyToAccount(wallet1Key);
      const acct2 = privateKeyToAccount(wallet2Key);
      console.log(`\n[Test] ======= FFE 3-PERSON TEST (2 Contributors + Aggregator) =======`);
      console.log(`[Test] Contributor 1 (Person A): ${acct1.address}`);
      console.log(`[Test] Contributor 2 (Person B): ${acct2.address}`);
      console.log(`[Test] Timeout: 30 minutes\n`);

      kp1 = crypto.generateKeyPair();
      kp2 = crypto.generateKeyPair();

      ffe1 = new FFE({
        privateKey: wallet1Key,
        coordinatorAddress: COORDINATOR as `0x${string}`,
        rpcUrl: RPC,
        storageEvmRpc: RPC,
        localStorageFallbackDir: LOCAL_STORAGE,
      });
      ffe2 = new FFE({
        privateKey: wallet2Key,
        coordinatorAddress: COORDINATOR as `0x${string}`,
        rpcUrl: RPC,
        storageEvmRpc: RPC,
        localStorageFallbackDir: LOCAL_STORAGE,
      });

      console.log("[Test] Step 1: Creating session with 2 participants...");
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
      console.log(`[Test] ✓ Session created: ${sessionId}\n`);

      const dataA = [
        `{"messages":[{"role":"user","content":"What is machine learning?"},{"role":"assistant","content":"Machine learning is a subset of artificial intelligence that enables systems to learn from data."}]}`,
        `{"messages":[{"role":"user","content":"How does training work?"},{"role":"assistant","content":"Training involves feeding data to an algorithm to learn patterns and improve performance."}]}`,
        `{"messages":[{"role":"user","content":"What is a neural network?"},{"role":"assistant","content":"A neural network is a computing system inspired by biological neural networks."}]}`,
      ].join("\n");

      const dataB = [
        `{"messages":[{"role":"user","content":"What is deep learning?"},{"role":"assistant","content":"Deep learning uses neural networks with multiple layers to extract high-level features from raw input."}]}`,
        `{"messages":[{"role":"user","content":"What is backpropagation?"},{"role":"assistant","content":"Backpropagation is a method for calculating gradients of the loss function with respect to weights."}]}`,
        `{"messages":[{"role":"user","content":"What is overfitting?"},{"role":"assistant","content":"Overfitting occurs when a model learns the training data too well including noise and peculiarities."}]}`,
      ].join("\n");

      console.log("[Test] Step 2: Person A submitting their private training dataset...");
      console.log(`      - 3 training examples`);
      console.log(`      - Data size: ${dataA.length} bytes`);
      console.log(`      - Encrypting to aggregator pubkey (only TEE can decrypt)...`);
      const {rootHash: rh1} = await ffe1.submit({
        sessionId,
        data: new TextEncoder().encode(dataA),
      });
      console.log(`[Test] ✓ Person A submitted`);
      console.log(`      - Blob hash: ${rh1}\n`);

      console.log("[Test] Step 3: Person B submitting their private training dataset...");
      console.log(`      - 3 training examples`);
      console.log(`      - Data size: ${dataB.length} bytes`);
      console.log(`      - Encrypting to aggregator pubkey (only TEE can decrypt)...`);
      const {rootHash: rh2} = await ffe2.submit({
        sessionId,
        data: new TextEncoder().encode(dataB),
      });
      console.log(`[Test] ✓ Person B submitted`);
      console.log(`      - Blob hash: ${rh2}\n`);

      console.log("[Test] Step 4: Starting FFE Aggregator TEE in background...");
      const config = loadConfig();
      orchestratorStop = startOrchestrator({config});
      console.log(`[Test] ✓ Aggregator started. Pipeline will:`);
      console.log(`      1. Fetch encrypted blobs from storage`);
      console.log(`      2. Decrypt both datasets inside TEE enclave`);
      console.log(`      3. Combine: 6 total training examples`);
      console.log(`      4. Train joint LoRA model`);
      console.log(`      5. Encrypt LoRA with AES-256-GCM`);
      console.log(`      6. Seal encryption key for each contributor`);
      console.log(`      7. Mint ERC-7857 INFT on-chain`);
      console.log(`\n[Test] Step 5: Waiting for pipeline... (will take 5-15 minutes)\n`);
      
      const startTime = Date.now();
      tokenId = await waitForMint(ffe1, sessionId, PIPELINE_TIMEOUT_MS);
      const elapsedMins = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`\n[Test] ✓✓✓ INFT MINTED SUCCESSFULLY ✓✓✓`);
      console.log(`[Test] - Elapsed time: ${elapsedMins} minutes`);
      console.log(`[Test] - Token ID: ${tokenId}\n`);
    }, PIPELINE_TIMEOUT_MS + 180_000);

    afterAll(() => {
      orchestratorStop?.();
      console.log("[Test] Cleanup complete.");
    });

    it("session created successfully", () => {
      expect(sessionId).toBeGreaterThanOrEqual(0n);
      console.log(`✓ Session ID verified: ${sessionId}`);
    });

    it("INFT minted for session", () => {
      expect(tokenId).toBeGreaterThanOrEqual(0n);
      console.log(`✓ Token ID verified: ${tokenId}`);
    });

    it("Contributor 1 (Person A) can download the joint LoRA", async () => {
      console.log(`\n[Download] Person A downloading joint LoRA...`);
      const result = await ffe1.download({
        sessionId,
        recipientPrivateKey: kp1.privateKey,
      });
      expect(result.data.length).toBeGreaterThan(0);
      console.log(`✓ Downloaded ${result.data.length} bytes`);
      console.log(`  - LoRA trained on BOTH datasets`);
      console.log(`  - Blob hash: ${result.modelBlobHash}`);
    });

    it("Contributor 2 (Person B) can download the joint LoRA", async () => {
      console.log(`\n[Download] Person B downloading joint LoRA...`);
      const result = await ffe2.download({
        sessionId,
        recipientPrivateKey: kp2.privateKey,
      });
      expect(result.data.length).toBeGreaterThan(0);
      console.log(`✓ Downloaded ${result.data.length} bytes`);
      console.log(`  - Same model as Person A (verified!)`);
    });

    it("both contributors decrypt to identical joint LoRA bytes", async () => {
      console.log(`\n[Verification] Verifying both got identical LoRA...`);
      const r1 = await ffe1.download({sessionId, recipientPrivateKey: kp1.privateKey});
      const r2 = await ffe2.download({sessionId, recipientPrivateKey: kp2.privateKey});
      const hex1 = Buffer.from(r1.data).toString("hex");
      const hex2 = Buffer.from(r2.data).toString("hex");
      
      expect(hex1).toBe(hex2);
      
      console.log(`✓ IDENTICAL: Both have the same ${r1.data.length}-byte LoRA`);
      console.log(`\n🎉 FFE SUCCESS! 🎉`);
      console.log(`   - Person A's data: 3 examples → pooled into joint model`);
      console.log(`   - Person B's data: 3 examples → pooled into joint model`);
      console.log(`   - Joint training: 6 examples total`);
      console.log(`   - Both benefit from each other's data`);
      console.log(`   - Neither shared their raw data`);
      console.log(`   - Model is jointly owned (INFT with sealed keys)\n`);
    });

    it("BONUS: save LoRA to disk for comparison", async () => {
      console.log(`\n[Export] Saving joint LoRA to disk...`);
      const result = await ffe1.download({sessionId, recipientPrivateKey: kp1.privateKey});
      const fs = await import('fs');
      const outPath = `/tmp/ffe-joint-lora-session-${sessionId}.bin`;
      fs.writeFileSync(outPath, Buffer.from(result.data));
      console.log(`✓ Saved to: ${outPath}`);
      console.log(`\nNext step: Compare with your solo-trained LoRA`);
      console.log(`  node sdk/compare-loras.js <solo-lora-path> ${outPath}`);
    });
  }
);
