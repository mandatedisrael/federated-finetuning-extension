/**
 * Training bridge for the Aggregator.
 * Calls the 0G fine-tuning service via @0gfoundation/0g-compute-ts-sdk (real mode)
 * or runs a deterministic TEE simulation for demo/dev mode.
 * No Python subprocess involved.
 */

import {readFile, writeFile, rm} from "fs/promises";
import {join} from "path";
import {createHash, randomBytes, createCipheriv} from "crypto";
import {JsonRpcProvider, Wallet} from "ethers";
import {createZGComputeNetworkBroker} from "@0gfoundation/0g-compute-ts-sdk";

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
  /** Encrypted LoRA adapter bytes (nonce‖authTag‖ciphertext) */
  encryptedAdapter: Uint8Array;
  /** Task metadata JSON — includes base_model, session_id, rank, mode */
  rawAdapterJson: string;
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

  // Encrypt adapter bytes: nonce(12) ‖ authTag(16) ‖ ciphertext
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey, nonce);
  const encBody = Buffer.concat([cipher.update(Buffer.from(adapterBytes)), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedAdapter = new Uint8Array(Buffer.concat([nonce, authTag, encBody]));

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

  const ethersProvider = new JsonRpcProvider(ftRpcUrl);
  const signer = new Wallet(evmPrivateKey, ethersProvider);
  const broker = await createZGComputeNetworkBroker(signer);
  const ft = broker.fineTuning;

  if (!ft) {
    throw new Error("[TrainingBridge] Fine-tuning broker unavailable (signer not a Wallet?)");
  }

  // Idempotent — safe to call every time
  console.error(`[TEE] Acknowledging provider TEE signer: ${ftProviderAddress}`);
  await ft.acknowledgeProviderSigner(ftProviderAddress);

  // Upload decrypted JSONL directly into the TEE (never leaves encrypted channel)
  console.error("[TEE] Uploading dataset to TEE...");
  const uploadResult = await ft.uploadDatasetToTEE(ftProviderAddress, jsonlPath);
  const datasetHash = uploadResult!.datasetHash;
  console.error(`[TEE] Dataset hash: ${datasetHash}`);

  // Write training hyperparameters to a temp file (SDK requires a path)
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

  // Submit the task
  console.error(`[TEE] Creating fine-tuning task (model: ${baseModel})...`);
  const taskId = await ft.createTask(ftProviderAddress, baseModel, datasetHash, paramsPath);
  await rm(paramsPath).catch(() => {});
  console.error(`[TEE] Task ID: ${taskId}`);

  // Poll until terminal state
  const deadline = Date.now() + timeoutMs;
  const startMs = Date.now();
  let lastProgress = "";

  while (Date.now() < deadline) {
    await sleep(15_000);
    try {
      const task = await ft.getTask(ftProviderAddress, taskId);
      const progress = task?.progress ?? "unknown";
      if (progress !== lastProgress) {
        const elapsed = Math.round((Date.now() - startMs) / 1000);
        console.error(`[TEE] [${elapsed}s] Progress: ${progress}`);
        lastProgress = progress;
      }
      if (progress === "Trained" || progress === "Delivered") break;
      if (progress === "Failed" || progress === "Cancelled") {
        throw new Error(`[TrainingBridge] Task ${taskId} ended with status: ${progress}`);
      }
    } catch (err) {
      // Provider may be temporarily unreachable while GPU is busy
      console.error("[TEE] Provider busy, retrying...");
    }
  }

  if (Date.now() >= deadline) {
    await ft.cancelTask(ftProviderAddress, taskId).catch(() => {});
    throw new Error(`[TrainingBridge] Training timed out after ${timeoutMs}ms (task: ${taskId})`);
  }

  // Download and acknowledge LoRA weights on-chain
  const adapterPath = join(tempDir, `lora_${taskId}.bin`);
  console.error("[TEE] Downloading LoRA weights...");
  await ft.acknowledgeModel(ftProviderAddress, taskId, adapterPath);

  const adapterBytes = new Uint8Array(await readFile(adapterPath));
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
