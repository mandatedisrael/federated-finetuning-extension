import { FFE, crypto } from "@notmartin/ffe";
import type {
  CreateFfeProjectSessionInput,
  CreateFfeProjectSessionResult,
  FfeSessionStatusResult,
  SubmitFfeContributionFile,
  SubmitFfeContributionResult,
} from "./types";

interface FfeServerConfig {
  privateKey: `0x${string}`;
  coordinatorAddress?: `0x${string}`;
  inftMinterAddress?: `0x${string}`;
  rpcUrl?: string;
  storageEvmRpc?: string;
  storageIndexerRpc?: string;
  localStorageFallbackDir?: string;
  baseModel: string;
  aggregatorPubkey: Uint8Array;
  aggregatorPubkeyHex: `0x${string}`;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requirePrivateKey(): `0x${string}` {
  const key = env("FFE_SERVER_PRIVATE_KEY") ?? env("AGG_EVM_KEY");
  if (!key?.startsWith("0x")) {
    throw new Error("Set FFE_SERVER_PRIVATE_KEY or AGG_EVM_KEY to a 0x-prefixed funded EVM key.");
  }
  return key as `0x${string}`;
}

function optionalAddress(name: string): `0x${string}` | undefined {
  const value = env(name);
  if (!value) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed EVM address.`);
  }
  return value as `0x${string}`;
}

function hexToBytes(value: string, name: string): Uint8Array {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[a-fA-F0-9]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`${name} must be valid hex.`);
  }
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function loadAggregatorPubkey(): { bytes: Uint8Array; hex: `0x${string}` } {
  const explicit = env("FFE_AGGREGATOR_X25519_PUBLIC_KEY");
  if (explicit) {
    const bytes = hexToBytes(explicit, "FFE_AGGREGATOR_X25519_PUBLIC_KEY");
    if (bytes.length !== 32) {
      throw new Error("FFE_AGGREGATOR_X25519_PUBLIC_KEY must be 32 bytes.");
    }
    return { bytes, hex: bytesToHex(bytes) };
  }

  const privateKey = env("AGG_X25519_KEY");
  if (!privateKey) {
    throw new Error("Set FFE_AGGREGATOR_X25519_PUBLIC_KEY or AGG_X25519_KEY for session creation.");
  }
  const bytes = hexToBytes(privateKey, "AGG_X25519_KEY");
  const pubkey = crypto.publicKeyFromPrivate(bytes);
  return { bytes: pubkey, hex: bytesToHex(pubkey) };
}

export function loadFfeServerConfig(): FfeServerConfig {
  const aggregator = loadAggregatorPubkey();
  return {
    privateKey: requirePrivateKey(),
    coordinatorAddress: optionalAddress("COORDINATOR_ADDRESS"),
    inftMinterAddress: optionalAddress("INFT_ADDRESS"),
    rpcUrl: env("RPC_URL"),
    storageEvmRpc: env("STORAGE_EVM_RPC") ?? env("RPC_URL"),
    storageIndexerRpc: env("STORAGE_INDEXER_URL"),
    localStorageFallbackDir: env("FFE_LOCAL_STORAGE_DIR"),
    baseModel: env("FFE_BASE_MODEL") ?? env("BASE_MODEL") ?? "Qwen/Qwen2.5-0.5B",
    aggregatorPubkey: aggregator.bytes,
    aggregatorPubkeyHex: aggregator.hex,
  };
}

export function createFfeClient(config = loadFfeServerConfig()): FFE {
  return new FFE({
    privateKey: config.privateKey,
    coordinatorAddress: config.coordinatorAddress,
    inftMinterAddress: config.inftMinterAddress,
    rpcUrl: config.rpcUrl,
    storageEvmRpc: config.storageEvmRpc,
    storageIndexerRpc: config.storageIndexerRpc,
    localStorageFallbackDir: config.localStorageFallbackDir,
  });
}

export async function createProxySession(
  input: CreateFfeProjectSessionInput,
): Promise<CreateFfeProjectSessionResult> {
  if (!input.goal.trim()) {
    throw new Error("Project goal is required.");
  }

  const config = loadFfeServerConfig();
  const ffe = createFfeClient(config);
  const participant = crypto.generateKeyPair();
  const result = await ffe.openSession({
    baseModel: config.baseModel,
    participants: [{ address: ffe.account, publicKey: participant.publicKey }],
    quorum: 1,
    aggregatorPubkey: config.aggregatorPubkey,
  });

  return {
    mode: "server-proxy",
    sessionId: result.sessionId.toString(),
    baseModel: config.baseModel,
    participantAddress: ffe.account,
    participantPubkey: bytesToHex(participant.publicKey),
    participantPrivateKey: bytesToHex(participant.privateKey),
    aggregatorPubkey: config.aggregatorPubkeyHex,
    createTxHash: result.createTxHash,
    setAggregatorTxHash: result.setAggregatorTxHash,
    createdAt: new Date().toISOString(),
  };
}

function chunkText(text: string, size = 3_000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function jsonlFromFiles(files: SubmitFfeContributionFile[]): string {
  const lines: string[] = [];
  for (const file of files) {
    const text = file.text.trim();
    if (!text) continue;

    if (file.name.toLowerCase().endsWith(".jsonl")) {
      lines.push(
        ...text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      );
      continue;
    }

    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        const parsed = JSON.parse(text) as unknown;
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        lines.push(...rows.map((row) => JSON.stringify({ source: file.name, ...asRecord(row) })));
        continue;
      } catch {
        // Fall through to text chunking if the JSON is malformed.
      }
    }

    lines.push(
      ...chunkText(text).map((content, index) =>
        JSON.stringify({
          source: file.name,
          chunk: index + 1,
          content,
        }),
      ),
    );
  }

  if (lines.length === 0) {
    throw new Error("No readable training text was found in the selected files.");
  }
  return `${lines.join("\n")}\n`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
}

export async function submitProxyContribution(input: {
  sessionId: string;
  contributor: { id: string; name: string };
  usableCount: number;
  files: SubmitFfeContributionFile[];
}): Promise<SubmitFfeContributionResult> {
  const sessionId = BigInt(input.sessionId);
  const ffe = createFfeClient();
  const jsonl = jsonlFromFiles(input.files);
  const data = new TextEncoder().encode(jsonl);
  const result = await ffe.submit({ sessionId, data });

  return {
    id: `sub_${result.submitTxHash.slice(2, 10)}`,
    contributorId: input.contributor.id,
    contributorName: input.contributor.name,
    sessionId: input.sessionId,
    exampleCount: input.usableCount,
    rootHash: result.rootHash,
    storageTxHash: result.storageTxHash,
    submitTxHash: result.submitTxHash,
    submittedAt: new Date().toISOString(),
  };
}

export async function getSessionStatus(sessionIdInput: string): Promise<FfeSessionStatusResult> {
  const sessionId = BigInt(sessionIdInput);
  const ffe = createFfeClient();
  const [session, participants, submitters] = await Promise.all([
    ffe.coordinator.getSession(sessionId),
    ffe.coordinator.getParticipants(sessionId),
    ffe.coordinator.getSubmitters(sessionId),
  ]);
  const status = session.status === 1 ? "quorum-reached" : "open";
  const submittedCount = Number(session.submittedCount);
  const quorum = Number(session.quorum);

  return {
    sessionId: sessionIdInput,
    status,
    stage: status === "quorum-reached" ? "training" : submittedCount > 0 ? "checking" : "waiting",
    quorum,
    submittedCount,
    participants: [...participants],
    submitters: [...submitters],
    aggregatorPubkeySet: session.aggregatorPubkey !== "0x" && session.aggregatorPubkey.length > 2,
  };
}
