/**
 * Configuration loader and validator for FFE Aggregator.
 * Ensures all required environment variables are present before startup.
 */

import {tmpdir} from "os";

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
  /** Temporary directory for per-session JSONL files */
  tempDir: string;
  /** Base model identifier for LoRA training */
  baseModel: string;
  /** Training subprocess timeout in ms (default: 1 hour) */
  trainingTimeoutMs: number;
  /** Maximum concurrent training sessions */
  maxConcurrentSessions: number;
  /** Local fallback directory for blob storage when 0G Storage is unavailable */
  localStorageDir: string;
  /** Use real 0G fine-tuning service (requires funded wallet on ft network) */
  useReal0GTraining: boolean;
  /** RPC URL for the 0G fine-tuning network (mainnet default) */
  ftRpcUrl: string;
  /** Fine-tuning provider address */
  ftProviderAddress: string;
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
    process.env.RPC_URL || "https://evmrpc.0g.ai";
  const storageIndexerUrl =
    process.env.STORAGE_INDEXER_URL ||
    "https://indexer-storage-testnet-turbo.0g.ai";
  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);

  if (isNaN(pollIntervalMs) || pollIntervalMs < 1000) {
    throw new Error("POLL_INTERVAL_MS must be a valid number >= 1000");
  }

  const tempDir = process.env.TEMP_DIR || tmpdir();
  const baseModel = process.env.BASE_MODEL || "Qwen/Qwen2.5-0.5B";

  const trainingTimeoutMs = parseInt(process.env.TRAINING_TIMEOUT_MS || "3600000", 10);
  if (isNaN(trainingTimeoutMs) || trainingTimeoutMs < 1000) {
    throw new Error("TRAINING_TIMEOUT_MS must be a valid number >= 1000");
  }

  const maxConcurrentSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "3", 10);
  if (isNaN(maxConcurrentSessions) || maxConcurrentSessions < 1) {
    throw new Error("MAX_CONCURRENT_SESSIONS must be a valid number >= 1");
  }

  const localStorageDir = process.env.FFE_LOCAL_STORAGE_DIR || "/tmp/ffe-storage";

  const useReal0GTraining =
    (process.env.USE_REAL_0G_TRAINING ?? "false").toLowerCase() === "true";
  const ftRpcUrl = process.env.FT_RPC_URL ?? "https://evmrpc.0g.ai";
  const ftProviderAddress =
    process.env.FT_PROVIDER_ADDRESS ?? "0x940b4a101CaBa9be04b16A7363cafa29C1660B0d";

  return {
    evmPrivateKey: evmPrivateKey as `0x${string}`,
    x25519PrivateKey,
    coordinatorAddress: coordinatorAddress as `0x${string}`,
    inftMinterAddress: inftMinterAddress as `0x${string}`,
    rpcUrl,
    storageIndexerUrl,
    pollIntervalMs,
    tempDir,
    baseModel,
    trainingTimeoutMs,
    maxConcurrentSessions,
    useReal0GTraining,
    ftRpcUrl,
    ftProviderAddress,
    localStorageDir,
  };
}
