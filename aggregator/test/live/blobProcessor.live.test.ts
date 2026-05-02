/**
 * Live integration test for blob processor on Galileo.
 * Uploads real encrypted blobs to 0G Storage, then downloads and decrypts them.
 * Gated by FFE_LIVE_BLOB_PROCESSOR=1.
 */

import {describe, it, expect, beforeAll} from "vitest";
import {type Hash} from "viem";
import {processBlobsToJsonl, cleanupBlobJsonl} from "../../src/blobProcessor";
import {crypto, storage} from "@notmartin/ffe";
import {tmpdir} from "os";

const skipLive = !process.env.FFE_LIVE_BLOB_PROCESSOR;

describe.skipIf(skipLive)(
  "BlobProcessor Live Test (0G Storage on Galileo)",
  () => {
    let blobHashes: Hash[] = [];
    let ownerPubkeys: Uint8Array[] = [];
    let aggregatorKeyPair: {publicKey: Uint8Array; privateKey: Uint8Array};

    beforeAll(async () => {
      // Generate test keypairs
      aggregatorKeyPair = crypto.generateKeyPair();

      // Create test data: 2 contributors with JSONL data
      const testData1 = JSON.stringify({input: "test1", output: "output1"}) + "\n" +
                        JSON.stringify({input: "test2", output: "output2"});
      const testData2 = JSON.stringify({input: "test3", output: "output3"}) + "\n" +
                        JSON.stringify({input: "test4", output: "output4"});

      // Initialize 0G Storage client with wallet for upload
      const storageKey = process.env.FFE_LIVE_STORAGE_PRIVATE_KEY;
      if (!storageKey) {
        throw new Error("FFE_LIVE_STORAGE_PRIVATE_KEY required for live blob processor test");
      }

      const storageClient = new storage.ZeroGStorage({
        privateKey: storageKey,
        indexerRpc: "https://indexer-storage-testnet-turbo.0g.ai",
      });

      // Encrypt blobs to aggregator's public key and upload
      console.log("[Live Test] Encrypting and uploading test blobs to 0G Storage...");

      const blob1 = crypto.encryptToRecipient(
        new TextEncoder().encode(testData1),
        aggregatorKeyPair.publicKey
      );
      const blob2 = crypto.encryptToRecipient(
        new TextEncoder().encode(testData2),
        aggregatorKeyPair.publicKey
      );

      const upload1 = await storageClient.upload(blob1.bytes);
      const upload2 = await storageClient.upload(blob2.bytes);

      blobHashes = [upload1.rootHash as Hash, upload2.rootHash as Hash];
      ownerPubkeys = [aggregatorKeyPair.publicKey, aggregatorKeyPair.publicKey];

      console.log(`[Live Test] Uploaded ${blobHashes.length} blobs to 0G Storage`);
      console.log(`[Live Test] Blob 1: ${blobHashes[0]}`);
      console.log(`[Live Test] Blob 2: ${blobHashes[1]}`);
    });

    it("should download and decrypt real blobs from 0G Storage", async () => {
      const result = await processBlobsToJsonl(
        blobHashes,
        ownerPubkeys,
        {
          storageIndexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
          aggregatorPrivateKey: aggregatorKeyPair.privateKey,
          sessionId: 1n,
          tempDir: tmpdir(),
        }
      );

      expect(result.blobCount).toBe(2);
      expect(result.jsonlPath).toMatch(/session_1\.jsonl$/);

      // Verify the JSONL file contains all records
      const {readFileSync} = await import("fs");
      const content = readFileSync(result.jsonlPath, "utf-8");
      const lines = content.trim().split("\n").filter((l) => l.length > 0);

      expect(lines.length).toBe(4); // 2 records per blob
      expect(lines[0]).toContain("test1");
      expect(lines[1]).toContain("test2");
      expect(lines[2]).toContain("test3");
      expect(lines[3]).toContain("test4");

      // Cleanup
      await cleanupBlobJsonl(result.jsonlPath);
    });

    it("should verify decrypted JSONL contains valid JSON", async () => {
      const result = await processBlobsToJsonl(
        blobHashes,
        ownerPubkeys,
        {
          storageIndexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
          aggregatorPrivateKey: aggregatorKeyPair.privateKey,
          sessionId: 2n,
          tempDir: tmpdir(),
        }
      );

      const {readFileSync} = await import("fs");
      const content = readFileSync(result.jsonlPath, "utf-8");
      const lines = content.trim().split("\n").filter((l) => l.length > 0);

      // Each line should be valid JSON
      for (const line of lines) {
        const record = JSON.parse(line);
        expect(record).toHaveProperty("input");
        expect(record).toHaveProperty("output");
      }

      // Cleanup
      await cleanupBlobJsonl(result.jsonlPath);
    });
  }
);
