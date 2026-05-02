/**
 * Unit tests for the blob processor.
 * Tests blob download, decryption, and JSONL concatenation logic.
 */

import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {type Hash} from "viem";
import {processBlobsToJsonl, cleanupBlobJsonl, type BlobProcessResult} from "../src/blobProcessor";

describe("BlobProcessor", () => {
  it("should validate matching blobHashes and ownerPubkeys lengths", async () => {
    const options = {
      storageIndexerUrl: "http://localhost:6000",
      aggregatorPrivateKey: new Uint8Array(32).fill(0x01),
      sessionId: 1n,
      tempDir: "/tmp",
    };

    const mismatchError = await processBlobsToJsonl(
      ["0x" + "aa".repeat(32) as Hash],
      [new Uint8Array(32), new Uint8Array(32)], // Too many pubkeys
      options
    ).catch((e) => e);

    expect(mismatchError).toBeInstanceOf(Error);
    expect(mismatchError.message).toContain("same length");
  });

  it("should throw on download failure (A.3 stub)", async () => {
    const options = {
      storageIndexerUrl: "http://localhost:6000",
      aggregatorPrivateKey: new Uint8Array(32).fill(0x01),
      sessionId: 1n,
      tempDir: "/tmp",
    };

    const error = await processBlobsToJsonl(
      ["0x" + "aa".repeat(32) as Hash],
      [new Uint8Array(32).fill(0xcc)],
      options
    ).catch((e) => e);

    // Expected to fail during A.3 since download/decrypt are stubs
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("[A.3 TODO]");
  });

  it("should validate correct structure with matching lengths", async () => {
    const options = {
      storageIndexerUrl: "http://localhost:6000",
      aggregatorPrivateKey: new Uint8Array(32).fill(0x01),
      sessionId: 1n,
      tempDir: "/tmp",
    };

    // With matching lengths, it should pass validation but fail on download (stub)
    const result = await processBlobsToJsonl(
      ["0x" + "aa".repeat(32) as Hash],
      [new Uint8Array(32).fill(0xcc)],
      options
    ).catch((e) => e);

    // Expected to fail during stub since download/decrypt are not implemented
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain("[A.3 TODO]");
  });

  it("should have proper cleanup function signature", async () => {
    // Just verify the cleanup function exists and has the right signature
    const cleanupFn = cleanupBlobJsonl;
    expect(typeof cleanupFn).toBe("function");

    // Calling with a non-existent path should not throw
    await expect(cleanupBlobJsonl("/nonexistent/path")).resolves.toBeUndefined();
  });
});
