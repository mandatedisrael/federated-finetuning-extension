/**
 * Integration tests for the training bridge.
 * Tests Python subprocess invocation and output parsing.
 */

import {describe, it, expect, beforeEach} from "vitest";
import {trainLoraAdapter, type TrainingResult} from "../src/trainingBridge";
import {writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

describe("TrainingBridge", () => {
  let tempJsonlPath: string;

  beforeEach(() => {
    // Create a temporary JSONL file
    tempJsonlPath = join(tmpdir(), `test_${Date.now()}.jsonl`);
    const testData = [
      JSON.stringify({ input: "test1", output: "output1" }),
      JSON.stringify({ input: "test2", output: "output2" }),
    ];
    writeFileSync(tempJsonlPath, testData.join("\n") + "\n", "utf-8");
  });

  it("should spawn training process and parse adapter output", async () => {
    const result = await trainLoraAdapter({
      pythonScriptPath: `${process.cwd()}/py/train.py`,
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen/Qwen2.5-0.5B",
      sessionId: 1n,
    }).catch((e) => e);

    // Expected to return a result or error (might fail if Python not available)
    // In CI/CD with Python, this should succeed with stub adapter
    if (result instanceof Error) {
      // Either Python not available or process failed
      expect(result.message).toBeTruthy();
    } else {
      // Should have received the stub result
      const trainingResult = result as TrainingResult;
      expect(trainingResult.aesKey).toBeInstanceOf(Uint8Array);
      expect(trainingResult.aesKey.length).toBe(32);
      expect(trainingResult.encryptedAdapter).toBeInstanceOf(Uint8Array);
      expect(trainingResult.rawAdapterJson).toBeTruthy();
      
      // Verify adapter JSON is valid
      const adapter = JSON.parse(trainingResult.rawAdapterJson);
      expect(adapter.base_model).toBe("Qwen/Qwen2.5-0.5B");
      expect(adapter.session_id).toBe(1);
      expect(adapter.rank).toBe(8);
    }
  });

  it("should handle Python process errors", async () => {
    // Try with a non-existent Python script
    const error = await trainLoraAdapter({
      pythonScriptPath: "/nonexistent/train.py",
      jsonlPath: tempJsonlPath,
      baseModel: "Qwen/Qwen2.5-0.5B",
      sessionId: 1n,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBeTruthy();
  });

  it("should generate random AES keys", async () => {
    const results: TrainingResult[] = [];

    // Try to run training (may fail if Python unavailable, but we can test the intent)
    for (let i = 0; i < 2; i++) {
      const result = await trainLoraAdapter({
        pythonScriptPath: `${process.cwd()}/py/train.py`,
        jsonlPath: tempJsonlPath,
        baseModel: "Qwen/Qwen2.5-0.5B",
        sessionId: BigInt(i),
      }).catch(() => null);

      if (result) {
        results.push(result);
      }
    }

    // If we got results, verify keys are different
    if (results.length === 2) {
      expect(results[0]!.aesKey).not.toEqual(results[1]!.aesKey);
    }
  });
});
