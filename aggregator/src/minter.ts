/**
 * Minter for the Aggregator.
 * Uploads encrypted LoRA to 0G Storage, seals keys, and calls INFTMinter.mint().
 */

import {type Address, type Hash} from "viem";
import {
  crypto,
  coordinator,
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
  // [A.5 TODO] Full implementation:
  // 1. Upload encrypted LoRA adapter to 0G Storage
  // 2. Receive blob hash (Merkle root)
  // 3. For each contributor:
  //    a. Seal the adapter AES key to their X25519 pubkey via SDK crypto.seal()
  //    b. Serialize sealed key to 92-byte wire format
  // 4. Create account from aggregatorEVMPrivateKey
  // 5. Create wallet client
  // 6. Call INFTMinter.mint() with the sealed keys and blob hash
  // 7. Return transaction hash, blob hash, and sealed keys

  throw new Error("[A.5 TODO] Implement NFT minting after LoRA training");
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
  // [A.5 TODO] Use SDK's crypto.seal() to create a sealed envelope
  // The result should be the sealed key bytes that can only be decrypted
  // by the recipient using their X25519 private key

  throw new Error("[A.5 TODO] Seal data key for contributor");
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
