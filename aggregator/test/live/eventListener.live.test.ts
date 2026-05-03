/**
 * Live integration test for event listener on 0G Mainnet.
 * Creates a real session, submits from 2 wallets, verifies event listener detects QuorumReached.
 * Gated by FFE_LIVE_EVENT_LISTENER=1.
 */

import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {type Address, toHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {FFE, coordinator, crypto} from "@notmartin/ffe";
import {startEventListener, type QuorumReachedPayload} from "../../src/eventListener";

const skipLive = !process.env.FFE_LIVE_EVENT_LISTENER;

describe.skipIf(skipLive)(
  "EventListener Live Test (Coordinator on 0G Mainnet)",
  () => {
    let sessionId: bigint;
    let detectedPayload: QuorumReachedPayload | null = null;

    beforeAll(async () => {
      // Get private keys from env
      const wallet1Key = process.env.FFE_LIVE_WALLET_1;
      const wallet2Key = process.env.FFE_LIVE_WALLET_2;

      if (!wallet1Key || !wallet2Key) {
        throw new Error(
          "FFE_LIVE_WALLET_1 and FFE_LIVE_WALLET_2 required (funded 0G Mainnet accounts as 0x-prefixed hex)"
        );
      }

      const wallet1Account = privateKeyToAccount(toHex(wallet1Key) as `0x${string}`);
      const wallet2Account = privateKeyToAccount(toHex(wallet2Key) as `0x${string}`);

      console.log(`[Live Test] Wallet 1: ${wallet1Account.address}`);
      console.log(`[Live Test] Wallet 2: ${wallet2Account.address}`);

      // Create session using FFE SDK (wallet1 creates)
      const ffe1 = new FFE({
        privateKey: wallet1Key,
        coordinatorAddress: "0x840C3E83A5f3430079Aff7247CD957c994076015" as Address,
        rpcUrl: "https://evmrpc.0g.ai",
      });

      const baseModel = toHex("test-model");

      // Generate X25519 keypairs for participants
      const kp1 = crypto.generateKeyPair();
      const kp2 = crypto.generateKeyPair();

      console.log(`[Live Test] Opening session with 2 participants, quorum=2...`);

      const openResult = await ffe1.openSession({
        baseModel,
        participants: [
          {address: wallet1Account.address, publicKey: kp1.publicKey},
          {address: wallet2Account.address, publicKey: kp2.publicKey},
        ],
        quorum: 2,
      });

      sessionId = openResult.sessionId;
      console.log(`[Live Test] Session created: ${sessionId}`);

      // Both wallets submit dummy JSONL data
      const testData1 = JSON.stringify({input: "data1", output: "output1"});
      const testData2 = JSON.stringify({input: "data2", output: "output2"});

      console.log(`[Live Test] Wallet 1 submitting data...`);
      const submit1 = await ffe1.submit({
        sessionId,
        data: new TextEncoder().encode(testData1),
      });
      console.log(`[Live Test] Wallet 1 submitted: ${submit1.rootHash}`);

      // Wallet 2 submits
      const ffe2 = new FFE({
        privateKey: wallet2Key,
        coordinatorAddress: "0x840C3E83A5f3430079Aff7247CD957c994076015" as Address,
        rpcUrl: "https://evmrpc.0g.ai",
      });

      console.log(`[Live Test] Wallet 2 submitting data...`);
      const submit2 = await ffe2.submit({
        sessionId,
        data: new TextEncoder().encode(testData2),
      });
      console.log(`[Live Test] Wallet 2 submitted: ${submit2.rootHash}`);

      console.log(`[Live Test] Session should now have QuorumReached`);
    });

    afterAll(async () => {
      console.log(`[Live Test] Test complete`);
    });

    it("should detect QuorumReached event via polling", async () => {
      const events: QuorumReachedPayload[] = [];

      const controller = startEventListener(
        "0x840C3E83A5f3430079Aff7247CD957c994076015" as Address,
        "https://evmrpc.0g.ai",
        1000, // 1 second poll interval for testing
        async (payload: QuorumReachedPayload) => {
          console.log(`[Live Test] Event listener detected session ${payload.sessionId}`);
          events.push(payload);
        }
      );

      // Wait up to 30 seconds for the event to be detected
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (events.some((e) => e.sessionId === sessionId)) {
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 500);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(null);
        }, 30000);
      });

      controller.abort();

      // Verify we detected the session
      expect(events.length).toBeGreaterThanOrEqual(1);
      const payload = events.find((e) => e.sessionId === sessionId);
      expect(payload).toBeDefined();

      if (payload) {
        detectedPayload = payload;
      }
    });

    it("should have correct submitters in detected payload", () => {
      expect(detectedPayload).toBeDefined();
      if (!detectedPayload) return;

      expect(detectedPayload.submitters).toHaveLength(2);
    });

    it("should have correct blob hashes in detected payload", () => {
      expect(detectedPayload).toBeDefined();
      if (!detectedPayload) return;

      expect(detectedPayload.blobHashes).toHaveLength(2);
      // Blob hashes are 32-byte hashes
      for (const hash of detectedPayload.blobHashes) {
        expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
      }
    });

    it("should have correct owner pubkeys in detected payload", () => {
      expect(detectedPayload).toBeDefined();
      if (!detectedPayload) return;

      expect(detectedPayload.ownerPubkeys).toHaveLength(2);
      // Each pubkey should be 32 bytes (X25519 public key)
      for (const pubkey of detectedPayload.ownerPubkeys) {
        expect(pubkey).toBeInstanceOf(Uint8Array);
        expect(pubkey.length).toBe(32);
      }
    });

    it("should handle polling for multiple polls without duplicates", async () => {
      const events: QuorumReachedPayload[] = [];

      const controller = startEventListener(
        "0x840C3E83A5f3430079Aff7247CD957c994076015" as Address,
        "https://evmrpc.0g.ai",
        500, // Fast polling
        async (payload: QuorumReachedPayload) => {
          events.push(payload);
        }
      );

      // Let it poll for 3 seconds
      await new Promise((resolve) => setTimeout(resolve, 3000));
      controller.abort();

      // Filter to only our session
      const ourEvents = events.filter((e) => e.sessionId === sessionId);

      // Should only detect our session once (deduplication works)
      expect(ourEvents.length).toBeLessThanOrEqual(1);
    });
  }
);
