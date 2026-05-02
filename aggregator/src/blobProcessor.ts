/**
 * Blob processor for the Aggregator.
 * Downloads blobs from 0G Storage, decrypts them, and concatenates into JSONL.
 */

import {writeFile, rm} from "fs/promises";
import {type Address, type Hash} from "viem";
import {
  crypto,
  coordinator as coordinatorModule,
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

  const jsonlPath = `${options.tempDir}/session_${options.sessionId}.jsonl`;
  const lines: string[] = [];

  // Download and decrypt each blob
  for (let i = 0; i < blobHashes.length; i++) {
    const blobHash = blobHashes[i]!;
    const ownerPubkey = ownerPubkeys[i]!;

    try {
      // Download blob from 0G Storage
      // Using a stub for now — in A.3's full version, we'd call the 0G indexer
      // to fetch the blob by its Merkle root hash
      const encryptedBlob = await downloadBlobFrom0G(blobHash, options.storageIndexerUrl);

      // Decrypt using SDK's crypto utilities
      const decryptedJsonl = await decryptBlobForAggregator(
        encryptedBlob,
        ownerPubkey,
        options.aggregatorPrivateKey
      );

      // Append to lines (each line should be a complete JSON record)
      lines.push(...decryptedJsonl.split("\n").filter((line) => line.trim()));
    } catch (err) {
      console.error(
        `[BlobProcessor] Failed to download/decrypt blob ${i} (${blobHash}):`,
        err
      );
      throw err;
    }
  }

  // Write concatenated JSONL to file
  await writeFile(jsonlPath, lines.join("\n") + "\n", "utf-8");

  return {
    jsonlPath,
    blobCount: blobHashes.length,
  };
}

/**
 * Download a blob from 0G Storage by its Merkle root hash.
 * (Stub: full implementation in A.3)
 */
async function downloadBlobFrom0G(
  blobHash: Hash,
  _indexerUrl: string
): Promise<Uint8Array> {
  // This would call the 0G indexer to fetch the blob by hash
  // For now, throw to indicate this needs A.3 full implementation
  throw new Error(
    `[A.3 TODO] Download blob ${blobHash} from 0G Storage indexer`
  );
}

/**
 * Decrypt a blob for the aggregator.
 * Stub implementation for now.
 */
async function decryptBlobForAggregator(
  _encryptedBlob: Uint8Array,
  _ownerPubkey: Uint8Array,
  _aggregatorPrivateKey: Uint8Array
): Promise<string> {
  // In A.3 full version, this would:
  // 1. Extract the ephemeral pubkey and nonce from the blob header
  // 2. Derive the shared secret via X25519
  // 3. Derive the decryption key via HKDF
  // 4. Decrypt the ciphertext via AES-256-GCM
  // 5. Return the JSONL string
  throw new Error("[A.3 TODO] Decrypt blob for aggregator recipient");
}

/**
 * Clean up temporary JSONL file.
 */
export async function cleanupBlobJsonl(jsonlPath: string): Promise<void> {
  try {
    await rm(jsonlPath);
  } catch (err) {
    console.warn(`[BlobProcessor] Failed to clean up ${jsonlPath}:`, err);
  }
}
