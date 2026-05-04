/**
 * Training bridge for the Aggregator.
 * Uses 0g-compute-cli for real fine-tuning or simulates TEE for demo/dev.
 */

import {readFile, writeFile, rm} from "fs/promises";
import {join} from "path";
import {createHash, randomBytes} from "crypto";
import {createRequire} from "module";
import {crypto as ffeCrypto} from "@notmartin/ffe";
import {JsonRpcProvider, Wallet} from "ethers";
import type {
  createFineTuningBroker as createFineTuning,
  createZGComputeNetworkBroker as createBroker,
} from "@0gfoundation/0g-compute-ts-sdk";

const require = createRequire(join(process.cwd(), "package.json"));
const {
  CONTRACT_ADDRESSES,
  createFineTuningBroker,
  createZGComputeNetworkBroker,
} = require("@0gfoundation/0g-compute-ts-sdk") as {
  CONTRACT_ADDRESSES: {
    mainnet: {fineTuning: string};
    testnet: {fineTuning: string};
    hardhat: {fineTuning: string};
  };
  createFineTuningBroker: typeof createFineTuning;
  createZGComputeNetworkBroker: typeof createBroker;
};

export interface TrainingBridgeOptions {
  /** Path to input JSONL file (decrypted contributor data) */
  jsonlPath: string;
  /** Base model identifier (e.g., "Qwen2.5-0.5B-Instruct") */
  baseModel: string;
  /** Session ID for logging and temp file naming */
  sessionId: bigint;
  /** Temporary directory for training params and downloaded weights */
  tempDir: string;
  /** Total allowed wall-clock time in ms (default: 1 hour) */
  timeoutMs?: number;
  /** Set true to call the real 0G fine-tuning service */
  useReal0GTraining?: boolean;
  /** Aggregator EVM private key — required when useReal0GTraining=true */
  evmPrivateKey?: `0x${string}`;
  /** RPC URL for the 0G fine-tuning network (mainnet or testnet) */
  ftRpcUrl?: string;
  /** Fine-tuning provider address */
  ftProviderAddress?: string;
}

export interface TrainingResult {
  /** Generated AES-256 key for encrypting the adapter */
  aesKey: Uint8Array;
  /** Encrypted LoRA adapter bytes (nonce‖ciphertext-with-auth-tag) */
  encryptedAdapter: Uint8Array;
  /** Task metadata JSON — includes base_model, session_id, rank, mode */
  rawAdapterJson: string;
}

interface FineTuningLike {
  acknowledgeModel(
    providerAddress: string,
    taskId: string,
    dataPath: string,
    options?: {downloadMethod?: "tee" | "0g-storage" | "auto"}
  ): Promise<void>;
  acknowledgeProviderSigner(providerAddress: string): Promise<void>;
  cancelTask(providerAddress: string, taskId: string): Promise<string>;
  createTask(
    providerAddress: string,
    preTrainedModelName: string,
    datasetHash: string,
    trainingPath: string
  ): Promise<string>;
  decryptModel(
    providerAddress: string,
    taskId: string,
    encryptedModelPath: string,
    decryptedModelPath: string
  ): Promise<void>;
  getTask(providerAddress: string, taskId: string): Promise<{progress?: string} | undefined>;
  listTask(providerAddress: string): Promise<Array<{id?: string; progress?: string}>>;
  uploadDatasetToTEE(
    providerAddress: string,
    datasetPath: string
  ): Promise<{datasetHash: string; message: string}>;
}

export async function assertFineTuningProviderReady(options: {
  evmPrivateKey: `0x${string}`;
  ftRpcUrl: string;
  ftProviderAddress: string;
}): Promise<void> {
  const ft = await createFineTuningClient(options.evmPrivateKey, options.ftRpcUrl);
  const tasks = await ft.listTask(options.ftProviderAddress);
  const unfinished = tasks.find((task) => !isTerminalTaskProgress(task.progress));
  if (!unfinished) return;

  throw new Error(
    `[Preflight] Fine-tuning provider has unfinished task ${unfinished.id ?? "(unknown)"} with status ${unfinished.progress ?? "unknown"}. Wait until it is Finished, Failed, or Cancelled before running pnpm start.`
  );
}

/**
 * Train a LoRA adapter for the given session's JSONL data.
 * Produces an AES-256-GCM encrypted adapter ready for upload to 0G Storage.
 */
export async function trainLoraAdapter(
  options: TrainingBridgeOptions
): Promise<TrainingResult> {
  const aesKey = randomBytes(32);

  const {adapterBytes, metadata} = options.useReal0GTraining
    ? await trainWith0GService(options)
    : await simulateTraining(options);

  // Encrypt adapter bytes in the SDK download format:
  // nonce(12) ‖ ciphertext-with-auth-tag.
  const encrypted = ffeCrypto.aeadEncrypt(aesKey, adapterBytes);
  const encryptedAdapter = new Uint8Array(
    encrypted.nonce.length + encrypted.ciphertext.length
  );
  encryptedAdapter.set(encrypted.nonce, 0);
  encryptedAdapter.set(encrypted.ciphertext, encrypted.nonce.length);

  return {
    aesKey: new Uint8Array(aesKey),
    encryptedAdapter,
    rawAdapterJson: JSON.stringify(metadata),
  };
}

// ---------------------------------------------------------------------------
// Real 0G fine-tuning service path
// ---------------------------------------------------------------------------

async function trainWith0GService(options: TrainingBridgeOptions): Promise<{
  adapterBytes: Uint8Array;
  metadata: object;
}> {
  const {
    evmPrivateKey,
    ftRpcUrl,
    ftProviderAddress,
    tempDir,
    sessionId,
    baseModel,
    jsonlPath,
    timeoutMs = 3_600_000,
  } = options;

  if (!evmPrivateKey || !ftRpcUrl || !ftProviderAddress) {
    throw new Error(
      "[TrainingBridge] useReal0GTraining=true requires evmPrivateKey, ftRpcUrl, and ftProviderAddress"
    );
  }

  console.error(`[TEE] Connecting to 0G fine-tuning service at ${ftRpcUrl}`);

  const ft = await createFineTuningClient(evmPrivateKey, ftRpcUrl);

  console.error(`[TEE] Acknowledging provider TEE signer: ${ftProviderAddress}`);
  await ft.acknowledgeProviderSigner(ftProviderAddress);

  console.error(`[TEE] Uploading dataset directly to TEE: ${jsonlPath}`);
  const uploadResult = await ft.uploadDatasetToTEE(ftProviderAddress, jsonlPath);
  const datasetHash = uploadResult.datasetHash;
  console.error(`[TEE] Dataset hash: ${datasetHash}`);

  const paramsPath = join(tempDir, `training_params_${sessionId}.json`);
  await writeFile(
    paramsPath,
    JSON.stringify({
      learning_rate: 0.0002,
      num_train_epochs: 5,
      per_device_train_batch_size: 1,
      neftune_noise_alpha: 5,
      max_steps: 200,
    })
  );

  console.error(`[TEE] Creating fine-tuning task (model: ${baseModel})...`);
  const taskId = await ft.createTask(ftProviderAddress, baseModel, datasetHash, paramsPath);
  await rm(paramsPath).catch(() => {});
  console.error(`[TEE] Task ID: ${taskId}`);

  const deadline = Date.now() + timeoutMs;
  const startMs = Date.now();
  let lastProgress = "";

  while (Date.now() < deadline) {
    await sleep(15_000);
    let task;
    try {
      task = await ft.getTask(ftProviderAddress, taskId);
    } catch (err) {
      console.error("[TEE] Provider busy, retrying...");
      continue;
    }

    const progress = task?.progress ?? "unknown";
    if (progress !== lastProgress) {
      const elapsed = Math.round((Date.now() - startMs) / 1000);
      console.error(`[TEE] [${elapsed}s] Progress: ${progress}`);
      lastProgress = progress;
    }
    if (progress === "Delivered" || progress === "Finished") break;
    if (progress === "Failed" || progress === "Cancelled") {
      throw new Error(`[TrainingBridge] Task ${taskId} ended with status: ${progress}`);
    }
  }

  if (Date.now() >= deadline) {
    await ft.cancelTask(ftProviderAddress, taskId).catch(() => {});
    throw new Error(`[TrainingBridge] Training timed out after ${timeoutMs}ms (task: ${taskId})`);
  }

  const encryptedAdapterPath = join(tempDir, `lora_${taskId}.encrypted.bin`);
  const adapterPath = join(tempDir, `lora_${taskId}.zip`);
  console.error("[TEE] Downloading encrypted LoRA weights...");
  await acknowledgeModelWithRetry(
    ft,
    ftProviderAddress,
    taskId,
    encryptedAdapterPath,
    Math.max(0, deadline - Date.now())
  );

  console.error("[TEE] Waiting for provider settlement and decryption key...");
  await waitForTaskProgress(ft, ftProviderAddress, taskId, "Finished", deadline);

  console.error("[TEE] Decrypting LoRA weights...");
  await ft.decryptModel(ftProviderAddress, taskId, encryptedAdapterPath, adapterPath);

  const adapterBytes = new Uint8Array(await readFile(adapterPath));
  await rm(encryptedAdapterPath).catch(() => {});
  await rm(adapterPath).catch(() => {});

  console.error(`[TEE] Training complete — adapter size: ${adapterBytes.length} bytes`);

  return {
    adapterBytes,
    metadata: {
      task_id: taskId,
      base_model: baseModel,
      session_id: Number(sessionId),
      rank: 8,
      adapter_size_bytes: adapterBytes.length,
      mode: "real_0g",
      timestamp: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Simulation path (TEE demo / dev mode)
// ---------------------------------------------------------------------------

async function simulateTraining(options: TrainingBridgeOptions): Promise<{
  adapterBytes: Uint8Array;
  metadata: object;
}> {
  const {jsonlPath, baseModel, sessionId} = options;

  const content = await readFile(jsonlPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const n = lines.length;
  const steps = Math.max(1, Math.floor(n / 2));

  console.error("[TEE] Aggregator running inside Trusted Execution Environment (simulation)");
  console.error(`[TEE] Session: ${sessionId}  Samples: ${n}  Model: ${baseModel}`);

  for (let step = 1; step <= steps; step++) {
    const loss = (2.3 * Math.pow(0.85, step)).toFixed(4);
    console.error(`[TEE] Epoch 1/1  step ${step}/${steps}  loss=${loss}`);
  }

  const dataFingerprint = createHash("sha256").update(lines.join("\n")).digest("hex");
  const adapterFingerprint = createHash("sha256")
    .update(`${sessionId}:${dataFingerprint}`)
    .digest("hex");
  const attestationNonce = createHash("sha256")
    .update(`${sessionId}:${adapterFingerprint}`)
    .digest("hex");

  const metadata = {
    base_model: baseModel,
    session_id: Number(sessionId),
    rank: 8,
    lora_alpha: 16,
    training_samples: n,
    data_fingerprint: dataFingerprint,
    adapter_fingerprint: adapterFingerprint,
    tee_attestation: {
      tee_type: "Intel TDX (mock)",
      enclave_measurement:
        "mrenclave:" + createHash("sha256").update("ffe-aggregator-v0.1").digest("hex"),
      session_id: sessionId.toString(),
      adapter_hash: adapterFingerprint,
      nonce: attestationNonce,
      timestamp: new Date().toISOString(),
      note: "mock attestation — swap for real Tapp quote before mainnet",
    },
    mode: "tee_simulation",
    timestamp: new Date().toISOString(),
  };

  console.error(`[TEE] Attestation nonce: ${attestationNonce.slice(0, 16)}...`);
  console.error("[TEE] Training complete");

  // Adapter bytes = serialized metadata (represents weights in simulation)
  const adapterBytes = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
  return {adapterBytes, metadata};
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function acknowledgeModelWithRetry(
  ft: Pick<FineTuningLike, "acknowledgeModel">,
  providerAddress: string,
  taskId: string,
  adapterPath: string,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      await ft.acknowledgeModel(providerAddress, taskId, adapterPath, {
        downloadMethod: "auto",
      });
      return;
    } catch (err) {
      if (!isDeliverablePending(err) || Date.now() >= deadline) {
        throw err;
      }
      const delayMs = Math.min(30_000, Math.max(5_000, deadline - Date.now()));
      console.error(
        `[TEE] Deliverable not ready yet for task ${taskId}; retry ${attempt} in ${Math.round(delayMs / 1000)}s`
      );
      await sleep(delayMs);
    }
  }
}

async function waitForTaskProgress(
  ft: Pick<FineTuningLike, "getTask">,
  providerAddress: string,
  taskId: string,
  desiredProgress: string,
  deadline: number
): Promise<void> {
  let lastProgress = "";
  while (Date.now() < deadline) {
    const task = await ft.getTask(providerAddress, taskId);
    const progress = task?.progress ?? "unknown";
    if (progress !== lastProgress) {
      console.error(`[TEE] Progress: ${progress}`);
      lastProgress = progress;
    }
    if (progress === desiredProgress) return;
    if (progress === "Failed" || progress === "Cancelled") {
      throw new Error(`[TrainingBridge] Task ${taskId} ended with status: ${progress}`);
    }
    await sleep(15_000);
  }

  throw new Error(`[TrainingBridge] Timed out waiting for task ${taskId} to reach ${desiredProgress}`);
}

function isDeliverablePending(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("DeliverableNotExists") ||
    message.includes("No deliverable found") ||
    message.includes("Deliverable not acknowledged yet")
  );
}

async function createFineTuningClient(
  evmPrivateKey: `0x${string}`,
  ftRpcUrl: string
): Promise<FineTuningLike> {
  const ethersProvider = new JsonRpcProvider(ftRpcUrl);
  const signer = new Wallet(evmPrivateKey, ethersProvider);
  const broker = await createZGComputeNetworkBroker(signer);
  const ft = broker.fineTuning ?? await createFineTuningBroker(
    signer,
    fineTuningContractForNetwork((await ethersProvider.getNetwork()).chainId),
    broker.ledger
  );

  if (!ft) {
    throw new Error("[TrainingBridge] Fine-tuning broker unavailable");
  }

  return ft as FineTuningLike;
}

function isTerminalTaskProgress(progress: string | undefined): boolean {
  return progress === "Finished" || progress === "Failed" || progress === "Cancelled";
}

function fineTuningContractForNetwork(chainId: bigint): string {
  if (process.env.FT_CONTRACT_ADDRESS) {
    return process.env.FT_CONTRACT_ADDRESS;
  }
  if (chainId === 16661n) return CONTRACT_ADDRESSES.mainnet.fineTuning;
  if (chainId === 16602n) return CONTRACT_ADDRESSES.testnet.fineTuning;
  return CONTRACT_ADDRESSES.hardhat.fineTuning;
}
