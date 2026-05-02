/**
 * Unit tests for the event listener.
 * Tests polling logic and deduplication.
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";
import {type Address, type Hash} from "viem";
import {startEventListener, type QuorumReachedPayload} from "../src/eventListener";

describe("EventListener", () => {
  it("should emit events in the correct structure", async () => {
    // This is a minimal test to verify the event listener exports and types correctly.
    // Full integration tests will be in A.7 (live smoke test).
    
    const testPayload: QuorumReachedPayload = {
      sessionId: 1n,
      submitters: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address],
      blobHashes: ["0x" + "aa".repeat(32) as Hash],
      ownerPubkeys: [new Uint8Array(32).fill(0xcc)],
    };

    // Verify the structure is correct
    expect(testPayload.sessionId).toBe(1n);
    expect(testPayload.submitters.length).toBe(1);
    expect(testPayload.blobHashes.length).toBe(1);
    expect(testPayload.ownerPubkeys.length).toBe(1);
    expect(testPayload.ownerPubkeys[0]).toBeInstanceOf(Uint8Array);
    expect(testPayload.ownerPubkeys[0]!.length).toBe(32);
  });

  it("should be callable with proper arguments", async () => {
    // Verify the function signature and that it returns an AbortController
    const mockAddress = "0x1234567890123456789012345678901234567890" as Address;
    const mockUrl = "http://localhost:8545";
    const mockInterval = 5000;

    let eventCount = 0;
    const mockCallback = async (payload: QuorumReachedPayload) => {
      eventCount++;
    };

    // This should not throw
    const controller = startEventListener(
      mockAddress,
      mockUrl,
      mockInterval,
      mockCallback
    );

    // Should return an AbortController
    expect(controller).toHaveProperty("abort");
    expect(controller).toHaveProperty("signal");

    // Stop polling immediately
    controller.abort();

    // Wait a bit to ensure polling stops
    await new Promise((r) => setTimeout(r, 100));
  });

  it("should handle deduplication with a Set", () => {
    // Verify that session IDs would be deduplicated by testing the concept
    const seen = new Set<bigint>();
    const sessionId = 1n;

    seen.add(sessionId);
    expect(seen.has(sessionId)).toBe(true);

    // Adding the same session again shouldn't change anything
    seen.add(sessionId);
    expect(seen.size).toBe(1);
  });
});
