/**
 * Configuration loader and validator for FFE Aggregator.
 * Ensures all required environment variables are present before startup.
 */

export interface AggregatorConfig {
  /** EVM private key (aggregator wallet) */
  evmPrivateKey: `0x${string}`;
  /** X25519 private key (for decrypting contributor blobs) */
  x25519PrivateKey: Uint8Array;
  /** Coordinator contract address on Galileo */
  coordinatorAddress: `0x${string}`;
  /** INFTMinter contract address on Galileo */
  inftMinterAddress: `0x${string}`;
  /** RPC URL for Galileo testnet */
  rpcUrl: string;
  /** 0G Storage indexer URL */
  storageIndexerUrl: string;
  /** Poll interval for QuorumReached events (ms) */
  pollIntervalMs: number;
}

/**
 * Load and validate aggregator configuration from environment variables.
 * @throws Error if any required variable is missing or invalid
 */
export function loadConfig(): AggregatorConfig {
  const evmPrivateKey = process.env.AGG_EVM_KEY;
  if (!evmPrivateKey || !evmPrivateKey.startsWith("0x")) {
    throw new Error(
      "AGG_EVM_KEY must be set and start with 0x (EVM private key as hex)"
    );
  }

  const x25519PrivateKeyHex = process.env.AGG_X25519_KEY;
  if (!x25519PrivateKeyHex) {
    throw new Error(
      "AGG_X25519_KEY must be set (32-byte X25519 private key as hex, no 0x prefix)"
    );
  }
  let x25519PrivateKey: Uint8Array;
  try {
    x25519PrivateKey = new Uint8Array(
      Buffer.from(x25519PrivateKeyHex, "hex")
    );
    if (x25519PrivateKey.length !== 32) {
      throw new Error("X25519 private key must be exactly 32 bytes");
    }
  } catch (err) {
    throw new Error(
      `AGG_X25519_KEY must be valid hex: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const coordinatorAddress = process.env.COORDINATOR_ADDRESS;
  if (!coordinatorAddress || !coordinatorAddress.startsWith("0x")) {
    throw new Error("COORDINATOR_ADDRESS must be set and start with 0x");
  }

  const inftMinterAddress = process.env.INFT_ADDRESS;
  if (!inftMinterAddress || !inftMinterAddress.startsWith("0x")) {
    throw new Error("INFT_ADDRESS must be set and start with 0x");
  }

  const rpcUrl =
    process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
  const storageIndexerUrl =
    process.env.STORAGE_INDEXER_URL ||
    "https://indexer-storage-testnet-turbo.0g.ai";
  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);

  if (isNaN(pollIntervalMs) || pollIntervalMs < 1000) {
    throw new Error("POLL_INTERVAL_MS must be a valid number >= 1000");
  }

  return {
    evmPrivateKey: evmPrivateKey as `0x${string}`,
    x25519PrivateKey,
    coordinatorAddress: coordinatorAddress as `0x${string}`,
    inftMinterAddress: inftMinterAddress as `0x${string}`,
    rpcUrl,
    storageIndexerUrl,
    pollIntervalMs,
  };
}
