/**
 * Unit tests for the blob processor.
 * Tests blob download, decryption, and JSONL concatenation logic.
 */

import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {type Hash} from "viem";
import {processBlobsToJsonl, cleanupBlobJsonl, type BlobProcessResult} from "../src/blobProcessor";
import {crypto, storage} from "@notmartin/ffe";
import {writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

describe("BlobProcessor", () => {
  it("should validate matching blobHashes and ownerPubkeys lengths", async () => {
    const options = {
      storageIndexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
      aggregatorPrivateKey: new Uint8Array(32).fill(0x01),
      sessionId: 1n,
      tempDir: tmpdir(),
    };

    const error = await processBlobsToJsonl(
      ["0x" + "aa".repeat(32) as Hash],
      [new Uint8Array(32), new Uint8Array(32)], // Too many pubkeys
      options
    ).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("same length");
  });

  it("should reject empty blob arrays", async () => {
    const options = {
      storageIndexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
      aggregatorPrivateKey: new Uint8Array(32).fill(0x01),
      sessionId: 1n,
      tempDir: tmpdir(),
    };

    const error = await processBlobsToJsonl([], [], options).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("At least one blob");
  });

  it("should handle cleanup of temporary files", async () => {
    const testPath = join(tmpdir(), `test_cleanup_${Date.now()}.jsonl`);
    writeFileSync(testPath, "test data");

    // Cleanup should succeed
    await expect(cleanupBlobJsonl(testPath)).resolves.toBeUndefined();
  });

  it("should handle cleanup of non-existent files gracefully", async () => {
    // Should not throw
    await expect(cleanupBlobJsonl("/nonexistent/path.jsonl")).resolves.toBeUndefined();
  });

  it("should validate 0G Storage client initialization", () => {
    // Verify that ZeroGStorage can be instantiated without a wallet (read-only)
    const storageClient = new storage.ZeroGStorage({
      indexerRpc: "https://indexer-storage-testnet-turbo.0g.ai",
    });

    expect(storageClient).toBeDefined();
    expect(storageClient.indexerRpc).toBe("https://indexer-storage-testnet-turbo.0g.ai");
  });

  it("should validate crypto.decryptForRecipient is available", () => {
    expect(typeof crypto.decryptForRecipient).toBe("function");
  });

  it("should validate crypto.encryptToRecipient creates decryptable blobs", () => {
    // Generate a keypair
    const {publicKey, privateKey} = crypto.generateKeyPair();
    const plaintext = new TextEncoder().encode(JSON.stringify({test: "data"}));

    // Encrypt to the public key
    const encrypted = crypto.encryptToRecipient(plaintext, publicKey);

    // Decrypt using the private key
    const decrypted = crypto.decryptForRecipient(encrypted.bytes, privateKey);

    // Verify plaintext matches
    expect(decrypted).toEqual(plaintext);
  });
});
