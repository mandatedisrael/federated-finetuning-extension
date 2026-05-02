/**
 * Blob processor for the Aggregator.
 * Downloads blobs from 0G Storage, decrypts them, and concatenates into JSONL.
 */

import {writeFile, rm} from "fs/promises";
import {type Hash} from "viem";
import {
  crypto,
  storage,
} from "@notmartin/ffe";

export interface BlobProcessorOptions {
  /** 0G Storage indexer URL */
  storageIndexerUrl: string;
  /** Aggregator's X25519 private key */
  aggregatorPrivateKey: Uint8Array;
  /** Session ID (used for temp file naming) */
  sessionId: bigint;
  /** Temporary directory for JSONL files */
  tempDir: string;
}

export interface BlobProcessResult {
  /** Path to the concatenated JSONL file */
  jsonlPath: string;
  /** Number of successfully decrypted blobs */
  blobCount: number;
}

/**
 * Download and decrypt blobs from 0G Storage, concatenate to JSONL.
 *
 * @param blobHashes Array of blob hashes (Merkle roots) from 0G Storage
 * @param ownerPubkeys Array of owner X25519 public keys (corresponding to blobHashes)
 * @param options Configuration for blob processing
 * @returns Path to JSONL file and count of blobs
 */
export async function processBlobsToJsonl(
  blobHashes: Hash[],
  ownerPubkeys: Uint8Array[],
  options: BlobProcessorOptions
): Promise<BlobProcessResult> {
  if (blobHashes.length !== ownerPubkeys.length) {
    throw new Error("blobHashes and ownerPubkeys must have the same length");
  }

  if (blobHashes.length === 0) {
    throw new Error("At least one blob must be provided");
  }

  const jsonlPath = `${options.tempDir}/session_${options.sessionId}.jsonl`;
  const lines: string[] = [];

  // Initialize 0G Storage client (read-only, no wallet needed for download)
  const storageClient = new storage.ZeroGStorage({
    indexerRpc: options.storageIndexerUrl,
  });

  // Download and decrypt each blob
  for (let i = 0; i < blobHashes.length; i++) {
    const blobHash = blobHashes[i]!;
    const ownerPubkey = ownerPubkeys[i]!;

    try {
      console.log(`[BlobProcessor] Downloading blob ${i + 1}/${blobHashes.length}: ${blobHash}`);

      // Download blob from 0G Storage by its Merkle root
      const encryptedBlob = await storageClient.download(blobHash);

      // Decrypt using SDK's crypto utility
      console.log(`[BlobProcessor] Decrypting blob ${i + 1}/${blobHashes.length}`);
      const decryptedBytes = crypto.decryptForRecipient(
        encryptedBlob,
        options.aggregatorPrivateKey
      );

      // Convert bytes to string (assume UTF-8 JSON)
      const decryptedJsonl = new TextDecoder().decode(decryptedBytes);

      // Append to lines (each line should be a complete JSON record)
      const blobLines = decryptedJsonl
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      
      lines.push(...blobLines);

      console.log(`[BlobProcessor] Blob ${i + 1}/${blobHashes.length} decrypted: ${blobLines.length} records`);
    } catch (err) {
      console.error(
        `[BlobProcessor] Failed to download/decrypt blob ${i} (${blobHash}):`,
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  }

  // Write concatenated JSONL to file
  console.log(`[BlobProcessor] Writing ${lines.length} total records to ${jsonlPath}`);
  await writeFile(jsonlPath, lines.join("\n") + "\n", "utf-8");

  return {
    jsonlPath,
    blobCount: blobHashes.length,
  };
}

/**
 * Clean up temporary JSONL file.
 */
export async function cleanupBlobJsonl(jsonlPath: string): Promise<void> {
  try {
    await rm(jsonlPath);
    console.log(`[BlobProcessor] Cleaned up ${jsonlPath}`);
  } catch (err) {
    console.warn(`[BlobProcessor] Failed to clean up ${jsonlPath}:`, err);
  }
}

