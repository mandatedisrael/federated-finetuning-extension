/**
 * Training bridge for the Aggregator.
 * Spawns a Python subprocess to fine-tune the LoRA adapter via 0G fine-tuning service.
 */

import {spawn, type ChildProcess} from "child_process";
import {randomBytes, createCipheriv, createDecipheriv} from "crypto";
import {
  crypto,
} from "@notmartin/ffe";

export interface TrainingBridgeOptions {
  /** Path to py/train.py script */
  pythonScriptPath: string;
  /** Path to input JSONL file */
  jsonlPath: string;
  /** Base model identifier (e.g., "Qwen/Qwen2.5-0.5B") */
  baseModel: string;
  /** Session ID for logging */
  sessionId: bigint;
}

export interface TrainingResult {
  /** Generated AES-256 key for encrypting the adapter */
  aesKey: Uint8Array;
  /** Encrypted LoRA adapter (JSON.stringify'd, then AES-256-GCM encrypted) */
  encryptedAdapter: Uint8Array;
  /** Raw adapter JSON (for debugging/validation) */
  rawAdapterJson: string;
}

/**
 * Spawn Python training subprocess and wait for encrypted adapter.
 *
 * @param options Training configuration
 * @returns AES key and encrypted adapter
 */
export async function trainLoraAdapter(
  options: TrainingBridgeOptions
): Promise<TrainingResult> {
  // Generate fresh AES-256 key
  const aesKey = randomBytes(32);

  return new Promise((resolve, reject) => {
    const process = spawn("python3", [
      options.pythonScriptPath,
      "--jsonl-path",
      options.jsonlPath,
      "--base-model",
      options.baseModel,
      "--session-id",
      options.sessionId.toString(),
    ]);

    let stdout = "";
    let stderr = "";

    process.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    process.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
      console.error(`[TrainingBridge] stderr: ${data.toString()}`);
    });

    process.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(
          new Error(
            `[TrainingBridge] Python process exited with code ${code}. stderr: ${stderr}`
          )
        );
        return;
      }

      try {
        // Parse stdout: first line is adapter JSON, rest is binary
        const lines = stdout.split("\n");
        if (lines.length < 1) {
          throw new Error("[TrainingBridge] No output from training process");
        }

        const rawAdapterJson = lines[0]!;
        // Validate it's valid JSON
        JSON.parse(rawAdapterJson);

        // Encrypt adapter JSON with AES-256-GCM using the generated key
        const adapterBytes = new TextEncoder().encode(rawAdapterJson);
        const nonce = randomBytes(12); // 96-bit nonce for GCM
        
        // Use Node.js crypto to encrypt with AES-256-GCM
        const cipher = createCipheriv("aes-256-gcm", aesKey, nonce);
        let encryptedData = cipher.update(adapterBytes);
        encryptedData = Buffer.concat([encryptedData, cipher.final()]);
        
        // Get the auth tag for GCM
        const authTag = cipher.getAuthTag();
        
        // Combine: nonce (12) + authTag (16) + ciphertext
        const fullEncrypted = Buffer.concat([nonce, authTag, encryptedData]);

        resolve({
          aesKey: new Uint8Array(aesKey),
          encryptedAdapter: new Uint8Array(fullEncrypted),
          rawAdapterJson,
        });
      } catch (err) {
        reject(
          new Error(
            `[TrainingBridge] Failed to parse training output: ${err instanceof Error ? err.message : String(err)}`
          )
        );
      }
    });

    process.on("error", (err: Error) => {
      reject(new Error(`[TrainingBridge] Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Kill a training process (cleanup on cancellation).
 */
export function killTrainingProcess(process: ChildProcess): void {
  if (process && !process.killed) {
    process.kill("SIGTERM");
  }
}
