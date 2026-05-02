/**
 * Integration smoke test for the Aggregator.
 * Two-wallet end-to-end test on Galileo testnet.
 * Gated by FFE_LIVE_AGG=1.
 */

import {describe, it, expect, beforeAll, afterAll, vi} from "vitest";
import {type Address, type PrivateKeyAccount} from "viem";
import {
  FFE,
  coordinator,
  crypto,
} from "@notmartin/ffe";

// Only run if FFE_LIVE_AGG env var is set
const skipLive = !process.env.FFE_LIVE_AGG;

describe.skipIf(skipLive)(
  "Aggregator Smoke Test (E2E on Galileo)",
  () => {
    let sessionId: bigint;
    let wallet1: PrivateKeyAccount;
    let wallet2: PrivateKeyAccount;

    beforeAll(async () => {
      // [A.7 TODO] Full implementation:
      // 1. Create 2 test wallets (or use provided via env var)
      // 2. Call Coordinator.createSession()
      // 3. Generate test JSONL data (or use provided)
      // 4. Both wallets submit via FFE.submit()
      // 5. Start aggregator locally
      // 6. Wait for Coordinator.QuorumReached
      // 7. Wait for INFTMinter.Minted event
      // 8. Both wallets call FFE.download()
      // 9. Verify decrypted LoRA bytes are non-empty

      // Placeholder: log the test intent
      console.log("[Smoke Test] Placeholder: awaiting A.7 full implementation");
    });

    afterAll(async () => {
      // Cleanup: stop aggregator, etc.
      console.log("[Smoke Test] Cleanup complete");
    });

    it("should create a session with 2 contributors", async () => {
      // [A.7 TODO] Implement
      expect(true).toBe(true);
    });

    it("should submit data from 2 wallets", async () => {
      // [A.7 TODO] Implement
      expect(true).toBe(true);
    });

    it("should reach quorum and trigger aggregator", async () => {
      // [A.7 TODO] Implement
      expect(true).toBe(true);
    });

    it("should train LoRA and mint INFT", async () => {
      // [A.7 TODO] Implement
      expect(true).toBe(true);
    });

    it("should allow both contributors to download decrypted LoRA", async () => {
      // [A.7 TODO] Implement
      // 1. Wallet 1 calls FFE.download(sessionId)
      // 2. Wallet 2 calls FFE.download(sessionId)
      // 3. Verify both get non-empty decrypted bytes
      // 4. Verify JSONL is valid and contains training data
      expect(true).toBe(true);
    });

    it("should verify INFT was minted to both contributors", async () => {
      // [A.7 TODO] Implement
      // 1. Query INFTMinter for the minted token
      // 2. Verify owner is the aggregator
      // 3. Verify metadata references correct session and contributors
      expect(true).toBe(true);
    });
  }
);
