/**
 * Minter for the Aggregator.
 * Uploads encrypted LoRA to 0G Storage, seals keys, and calls INFTMinter.mint().
 */

import {type Address, type Hash} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {
  crypto,
  storage,
  inft,
} from "@notmartin/ffe";

export interface MinterOptions {
  /** Aggregator's EVM private key (for signing mint tx) */
  aggregatorEVMPrivateKey: `0x${string}`;
  /** Aggregator's X25519 private key (for sealing) */
  aggregatorX25519PrivateKey: Uint8Array;
  /** INFTMinter contract address */
  inftMinterAddress: Address;
  /** RPC URL for Galileo */
  rpcUrl: string;
  /** 0G Storage indexer URL */
  storageIndexerUrl: string;
  /** Local fallback directory for blob storage when 0G is unavailable */
  localStorageDir?: string;
}

export interface MintingPayload {
  /** Session ID */
  sessionId: bigint;
  /** Encrypted LoRA adapter bytes */
  encryptedLoraAdapter: Uint8Array;
  /** AES key used to encrypt the adapter (will be sealed per contributor) */
  adapterAESKey: Uint8Array;
  /** Contributor addresses and their X25519 pubkeys */
  contributors: {
    address: Address;
    pubkey: Uint8Array;
  }[];
}

export interface MintResult {
  /** Transaction hash of the mint() call */
  txHash: Hash;
  /** Uploaded LoRA blob hash (0G Storage Merkle root) */
  loraBlobHash: Hash;
  /** SealedKey bytes for each contributor */
  sealedKeys: {
    contributor: Address;
    sealedKey: Uint8Array;
  }[];
}

/**
 * Mint NFT after successful LoRA training and upload.
 *
 * @param payload Encrypted LoRA and sealing data
 * @param options Minter configuration
 * @returns Transaction hash and blob hashes
 */
export async function mintLoraNFT(
  payload: MintingPayload,
  options: MinterOptions
): Promise<MintResult> {
  console.log(`[Minter] Starting NFT mint for session ${payload.sessionId}`);

  // 1. Upload encrypted LoRA adapter to 0G Storage
  console.log(`[Minter] Uploading encrypted LoRA to 0G Storage...`);
  const storageClient = new storage.ZeroGStorage({
    privateKey: options.aggregatorEVMPrivateKey,
    evmRpc: options.rpcUrl,
    indexerRpc: options.storageIndexerUrl,
    ...(options.localStorageDir ? {localFallbackDir: options.localStorageDir} : {}),
  });

  const uploadResult = await storageClient.upload(payload.encryptedLoraAdapter);
  if (!uploadResult?.rootHash) {
    throw new Error("[Minter] Upload to 0G Storage failed: no rootHash in response");
  }
  console.log(`[Minter] LoRA uploaded. Blob hash: ${uploadResult.rootHash}`);

  // 2. Seal the adapter AES key for each contributor
  console.log(`[Minter] Sealing AES key for ${payload.contributors.length} contributors...`);
  const sealedKeys: {
    contributor: Address;
    sealedKey: Uint8Array;
  }[] = [];

  for (const contributor of payload.contributors) {
    const sealed = crypto.seal(payload.adapterAESKey, contributor.pubkey);
    const sealedBytes = crypto.sealedKeyToBytes(sealed);
    sealedKeys.push({
      contributor: contributor.address,
      sealedKey: sealedBytes,
    });
  }

  // 3. Create account from aggregator's private key
  const account = privateKeyToAccount(options.aggregatorEVMPrivateKey);
  console.log(`[Minter] Aggregator account: ${account.address}`);

  // 4. Create INFTMinter client with wallet capabilities
  const minterClient = inft.createINFTMinterClient({
    address: options.inftMinterAddress,
    rpcUrl: options.rpcUrl,
    account,
  });

  // 5. Call INFTMinter.mint()
  console.log(`[Minter] Calling mint() on INFTMinter...`);
  const txHash = await minterClient.mint({
    sessionId: payload.sessionId,
    modelBlobHash: uploadResult.rootHash,
    contributors: payload.contributors.map((c) => c.address),
    sealedKeys: sealedKeys.map((s) => s.sealedKey),
  });

  console.log(`[Minter] Mint transaction: ${txHash}`);

  return {
    txHash: txHash as Hash,
    loraBlobHash: uploadResult.rootHash as Hash,
    sealedKeys,
  };
}

/**
 * Seal a data key for a specific recipient (contributor).
 * Uses SDK crypto.seal() with X25519 and returns the sealed envelope.
 */
export async function sealDataKeyForContributor(
  dataKey: Uint8Array,
  recipientX25519Pubkey: Uint8Array,
  aggregatorX25519PrivateKey: Uint8Array
): Promise<Uint8Array> {
  // Use SDK's crypto.seal() to create a sealed envelope
  // aggregatorX25519PrivateKey is the ephemeral secret (not actually used in seal, but included for API consistency)
  const sealed = crypto.seal(dataKey, recipientX25519Pubkey);
  return crypto.sealedKeyToBytes(sealed);
}

/**
 * Serialize a sealed key to the 92-byte wire format.
 * Wire format: [ephemeralPubkey (32)] + [nonce (16)] + [ciphertext (32)] + [tag (16)]
 */
export function sealedKeyToWireFormat(sealedEnvelope: Uint8Array): Uint8Array {
  if (sealedEnvelope.length !== 92) {
    throw new Error(
      `Invalid sealed key length: expected 92, got ${sealedEnvelope.length}`
    );
  }
  return sealedEnvelope; // Already 92 bytes from the seal operation
}
