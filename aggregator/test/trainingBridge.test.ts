/**
 * Tests for the training bridge.
 * Runs the TypeScript simulation path (no Python, no network).
 */

import {describe, it, expect, beforeEach} from "vitest";
import {trainLoraAdapter, type TrainingResult} from "../src/trainingBridge";
import {writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

const SAMPLE_JSONL = [
  JSON.stringify({messages: [{role: "user", content: "Hello"}, {role: "assistant", content: "Hi!"}]}),
  JSON.stringify({messages: [{role: "user", content: "Who are you?"}, {role: "assistant", content: "I am FFE."}]}),
];

describe("TrainingBridge", () => {
  let tempJsonlPath: string;

  beforeEach(() => {
    tempJsonlPath = join(tmpdir(), `test_${Date.now()}.jsonl`);
    writeFileSync(tempJsonlPath, SAMPLE_JSONL.join("\n") + "\n", "utf-8");
  });

  it("should run simulation and return encrypted adapter", async () => {
    const result = await trainLoraAdapter({
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen/Qwen2.5-0.5B",
      sessionId: 1n,
      tempDir: tmpdir(),
    });

    expect(result.aesKey).toBeInstanceOf(Uint8Array);
    expect(result.aesKey.length).toBe(32);
    expect(result.encryptedAdapter).toBeInstanceOf(Uint8Array);
    // nonce(12) + authTag(16) + ciphertext(>0)
    expect(result.encryptedAdapter.length).toBeGreaterThan(28);
    expect(result.rawAdapterJson).toBeTruthy();

    const meta = JSON.parse(result.rawAdapterJson);
    expect(meta.base_model).toBe("Qwen/Qwen2.5-0.5B");
    expect(meta.session_id).toBe(1);
    expect(meta.rank).toBe(8);
    expect(meta.mode).toBe("tee_simulation");
    expect(meta.tee_attestation).toBeDefined();
  });

  it("should produce unique AES keys across sessions", async () => {
    const r1 = await trainLoraAdapter({
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen/Qwen2.5-0.5B",
      sessionId: 1n,
      tempDir: tmpdir(),
    });
    const r2 = await trainLoraAdapter({
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen/Qwen2.5-0.5B",
      sessionId: 2n,
      tempDir: tmpdir(),
    });

    expect(r1.aesKey).not.toEqual(r2.aesKey);
  });

  it("should produce deterministic fingerprints for the same data", async () => {
    const r1 = await trainLoraAdapter({
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen/Qwen2.5-0.5B",
      sessionId: 1n,
      tempDir: tmpdir(),
    });
    const r2 = await trainLoraAdapter({
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen/Qwen2.5-0.5B",
      sessionId: 1n,
      tempDir: tmpdir(),
    });

    const m1 = JSON.parse(r1.rawAdapterJson);
    const m2 = JSON.parse(r2.rawAdapterJson);
    expect(m1.data_fingerprint).toBe(m2.data_fingerprint);
    expect(m1.adapter_fingerprint).toBe(m2.adapter_fingerprint);
  });

  it("should reject useReal0GTraining without required credentials", async () => {
    const error = await trainLoraAdapter({
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen2.5-0.5B-Instruct",
      sessionId: 1n,
      tempDir: tmpdir(),
      useReal0GTraining: true,
      // intentionally missing evmPrivateKey / ftRpcUrl / ftProviderAddress
    }).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("evmPrivateKey");
  });
});
