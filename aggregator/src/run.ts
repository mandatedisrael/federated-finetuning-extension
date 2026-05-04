/**
 * Live FFE end-to-end run.
 *
 * `pnpm start` loads `.env` and runs a two-contributor FFE training flow:
 * create session -> encrypted submits -> real 0G fine-tuning -> INFT
 * mint -> both contributors download and decrypt the same LoRA.
 */

import {mkdir, writeFile} from "fs/promises";
import {join} from "path";
import {
  createPublicClient,
  formatEther,
  http,
  type Address,
  type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {FFE, crypto} from "@notmartin/ffe";
import {loadConfig} from "./config.js";
import {startOrchestrator} from "./orchestrator.js";
import {assertFineTuningProviderReady} from "./trainingBridge.js";

const OUTPUT_DIR = "./output";
const DEFAULT_RPC_URL = "https://evmrpc.0g.ai";
const DEFAULT_BASE_MODEL = "Qwen2.5-0.5B-Instruct";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 10_000;
const MIN_CHAIN_BALANCE_WEI = 1n;

const ogMainnet = {
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: {name: "OG", symbol: "OG", decimals: 18},
  rpcUrls: {default: {http: [DEFAULT_RPC_URL]}},
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in aggregator/.env`);
  }
  return value;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

function asPrivateKey(name: string): Hex {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 32-byte private key`);
  }
  return value as Hex;
}

function asAddress(name: string): Address {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed address`);
  }
  return value as Address;
}

function decodeX25519PrivateKey(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("AGG_X25519_KEY must be 32-byte hex without 0x");
  }
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function encodeJsonl(records: unknown[]): Uint8Array {
  return new TextEncoder().encode(records.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

async function assertFunded(addresses: Record<string, Address>, rpcUrl: string): Promise<void> {
  const client = createPublicClient({
    chain: {...ogMainnet, rpcUrls: {default: {http: [rpcUrl]}}},
    transport: http(rpcUrl),
  });

  console.log("[Preflight] Checking 0G balances...");
  const empty: string[] = [];
  for (const [label, address] of Object.entries(addresses)) {
    const balance = await client.getBalance({address});
    console.log(`  ${label}: ${address} (${formatEther(balance)} OG)`);
    if (balance < MIN_CHAIN_BALANCE_WEI) empty.push(`${label} ${address}`);
  }

  if (empty.length > 0) {
    throw new Error(
      `These accounts need OG for live transactions before running pnpm start: ${empty.join(", ")}`
    );
  }
}

async function waitForMint(
  ffe: FFE,
  sessionId: bigint,
  timeoutMs: number
): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  let polls = 0;

  while (Date.now() < deadline) {
    polls += 1;
    try {
      if (await ffe.inft.hasMinted(sessionId)) {
        return await ffe.inft.getTokenBySession(sessionId);
      }
    } catch {
      // The mint may not exist yet. Keep polling until the timeout.
    }

    if (polls % 6 === 0) {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      console.log(`[Wait] Mint pending, ${remaining}s remaining`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`INFT mint was not detected within ${Math.round(timeoutMs / 1000)}s`);
}

async function main() {
  // Run the real 0G fine-tuning path by default for pnpm start.
  process.env.USE_REAL_0G_TRAINING = "true";

  const wallet1Key = asPrivateKey("FFE_LIVE_WALLET_1");
  const wallet2Key = asPrivateKey("FFE_LIVE_WALLET_2");
  const aggEvmKey = asPrivateKey("AGG_EVM_KEY");
  const aggX25519Key = decodeX25519PrivateKey(requireEnv("AGG_X25519_KEY"));
  const coordinatorAddress = asAddress("COORDINATOR_ADDRESS");
  const inftAddress = asAddress("INFT_ADDRESS");
  const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;
  const storageIndexerRpc = process.env.STORAGE_INDEXER_URL;
  const localStorageFallbackDir = process.env.FFE_LOCAL_STORAGE_DIR || "/tmp/ffe-storage";
  const baseModel = process.env.BASE_MODEL || DEFAULT_BASE_MODEL;
  const timeoutMs = envNumber("DEMO_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const aggregatorConfig = loadConfig();

  const contributor1 = privateKeyToAccount(wallet1Key);
  const contributor2 = privateKeyToAccount(wallet2Key);
  const aggregator = privateKeyToAccount(aggEvmKey);
  const aggregatorPubkey = crypto.publicKeyFromPrivate(aggX25519Key);

  await mkdir(OUTPUT_DIR, {recursive: true});
  await assertFunded(
    {
      contributor1: contributor1.address,
      contributor2: contributor2.address,
      aggregator: aggregator.address,
    },
    rpcUrl
  );
  await assertFineTuningProviderReady({
    evmPrivateKey: aggregatorConfig.evmPrivateKey,
    ftRpcUrl: aggregatorConfig.ftRpcUrl,
    ftProviderAddress: aggregatorConfig.ftProviderAddress,
  });

  console.log("\nFFE live E2E training");
  console.log(`Coordinator: ${coordinatorAddress}`);
  console.log(`INFT:        ${inftAddress}`);
  console.log(`Base model:  ${baseModel}`);
  console.log(`Mode:        real 0G fine-tuning\n`);

  const kp1 = crypto.generateKeyPair();
  const kp2 = crypto.generateKeyPair();

  const ffe1 = new FFE({
    privateKey: wallet1Key,
    coordinatorAddress,
    inftMinterAddress: inftAddress,
    rpcUrl,
    storageEvmRpc: rpcUrl,
    ...(storageIndexerRpc ? {storageIndexerRpc} : {}),
    localStorageFallbackDir,
  });
  const ffe2 = new FFE({
    privateKey: wallet2Key,
    coordinatorAddress,
    inftMinterAddress: inftAddress,
    rpcUrl,
    storageEvmRpc: rpcUrl,
    ...(storageIndexerRpc ? {storageIndexerRpc} : {}),
    localStorageFallbackDir,
  });

  console.log("[1/6] Creating live FFE session...");
  const {sessionId} = await ffe1.openSession({
    baseModel,
    participants: [
      {address: contributor1.address, publicKey: kp1.publicKey},
      {address: contributor2.address, publicKey: kp2.publicKey},
    ],
    quorum: 2,
    aggregatorPubkey,
  });
  console.log(`Session: ${sessionId}`);

  const keyCheckpointPath = join(OUTPUT_DIR, `ffe-session-${sessionId}-keys.json`);
  await writeFile(
    keyCheckpointPath,
    JSON.stringify(
      {
        version: 1,
        sessionId: sessionId.toString(),
        contributor1: {
          address: contributor1.address,
          publicKey: bytesToHex(kp1.publicKey),
          privateKey: bytesToHex(kp1.privateKey),
        },
        contributor2: {
          address: contributor2.address,
          publicKey: bytesToHex(kp2.publicKey),
          privateKey: bytesToHex(kp2.privateKey),
        },
      },
      null,
      2
    )
  );
  console.log(`Contributor decrypt keys saved: ${keyCheckpointPath}`);
  console.log("Keep that file private; it lets the contributors decrypt this session's LoRA.");

  const data1 = encodeJsonl([
    {
      messages: [
        {role: "user", content: "What is machine learning?"},
        {
          role: "assistant",
          content:
            "Machine learning is a way for software to learn patterns from data and improve task performance.",
        },
      ],
    },
    {
      messages: [
        {role: "user", content: "What does a training dataset do?"},
        {
          role: "assistant",
          content:
            "A training dataset gives examples that shape model behavior during fine-tuning.",
        },
      ],
    },
    {
      messages: [
        {role: "user", content: "What is a LoRA adapter?"},
        {
          role: "assistant",
          content:
            "A LoRA adapter is a compact set of fine-tuned weights that can be loaded with a base model.",
        },
      ],
    },
  ]);

  const data2 = encodeJsonl([
    {
      messages: [
        {role: "user", content: "How does FFE keep data private?"},
        {
          role: "assistant",
          content:
            "FFE encrypts contributor datasets to an aggregator TEE public key before upload.",
        },
      ],
    },
    {
      messages: [
        {role: "user", content: "Who receives the trained model?"},
        {
          role: "assistant",
          content:
            "Each accepted contributor receives access to the same jointly trained LoRA through sealed keys.",
        },
      ],
    },
    {
      messages: [
        {role: "user", content: "What does the INFT store?"},
        {
          role: "assistant",
          content:
            "The INFT records the encrypted model artifact and one sealed decryption key per contributor.",
        },
      ],
    },
  ]);

  console.log("[2/6] Contributor 1 submitting encrypted data...");
  const submission1 = await ffe1.submit({sessionId, data: data1});
  console.log(`Contributor 1 blob: ${submission1.rootHash}`);

  console.log("[3/6] Contributor 2 submitting encrypted data...");
  const submission2 = await ffe2.submit({sessionId, data: data2});
  console.log(`Contributor 2 blob: ${submission2.rootHash}`);

  console.log("[4/6] Starting aggregator real 0G fine-tuning...");
  let failSession: (error: Error) => void = () => {};
  const sessionFailure = new Promise<never>((_, reject) => {
    failSession = reject;
  });
  const stopOrchestrator = startOrchestrator({
    config: aggregatorConfig,
    targetSessionId: sessionId,
    onSessionError: (failedSessionId, error) => {
      if (failedSessionId === sessionId) failSession(error);
    },
  });

  try {
    console.log("[5/6] Waiting for INFT mint...");
    const tokenId = await Promise.race([
      waitForMint(ffe1, sessionId, timeoutMs),
      sessionFailure,
    ]);
    console.log(`Token: ${tokenId}`);

    console.log("[6/6] Verifying both contributors can decrypt the same LoRA...");
    const result1 = await ffe1.download({sessionId, recipientPrivateKey: kp1.privateKey});
    const result2 = await ffe2.download({sessionId, recipientPrivateKey: kp2.privateKey});

    const hex1 = Buffer.from(result1.data).toString("hex");
    const hex2 = Buffer.from(result2.data).toString("hex");
    if (hex1 !== hex2) {
      throw new Error("contributors decrypted different LoRA bytes");
    }

    const outPath = join(OUTPUT_DIR, `ffe-live-lora-session-${sessionId}.bin`);
    await writeFile(outPath, Buffer.from(result1.data));

    console.log("\nFFE live training succeeded");
    console.log(`Session: ${sessionId}`);
    console.log(`Token:   ${tokenId}`);
    console.log(`LoRA:    ${outPath}`);
    console.log(`Bytes:   ${result1.data.length}`);
  } finally {
    stopOrchestrator();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nFFE live training failed: ${message}`);
  process.exit(1);
});
