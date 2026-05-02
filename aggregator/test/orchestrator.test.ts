/**
 * Integration tests for the orchestrator.
 * Tests event wiring, error handling, and pipeline coordination.
 */

import {describe, it, expect} from "vitest";
import {type Address, type Hash} from "viem";
import {startOrchestrator, getOrchestratorState, type OrchestratorConfig} from "../src/orchestrator";
import {loadConfig} from "../src/config";

describe("Orchestrator", () => {
  it("should start and stop without errors", () => {
    // Mock config (won't actually connect to blockchain)
    const mockConfig: OrchestratorConfig = {
      config: {
        evmPrivateKey: "0x" + "1".repeat(64),
        x25519PrivateKey: new Uint8Array(32).fill(0x01),
        coordinatorAddress: "0x1234567890123456789012345678901234567890",
        inftMinterAddress: "0x0987654321098765432109876543210987654321",
        rpcUrl: "http://localhost:8545",
        storageIndexerUrl: "http://localhost:6000",
        pollIntervalMs: 5000,
      } as any,
    };

    const stopFn = startOrchestrator(mockConfig);
    expect(typeof stopFn).toBe("function");

    // Stop immediately
    stopFn();
  });

  it("should handle state initialization", () => {
    const state = {
      activeSessionIds: new Set<bigint>(),
      sessionErrors: new Map(),
    };

    const stateSnapshot = getOrchestratorState(state);
    expect(stateSnapshot.activeSessions.length).toBe(0);
    expect(stateSnapshot.errorLog.length).toBe(0);
  });

  it("should track active sessions", () => {
    const state = {
      activeSessionIds: new Set<bigint>([1n, 2n, 3n]),
      sessionErrors: new Map(),
    };

    const stateSnapshot = getOrchestratorState(state);
    expect(stateSnapshot.activeSessions).toContain(1n);
    expect(stateSnapshot.activeSessions).toContain(2n);
    expect(stateSnapshot.activeSessions).toContain(3n);
    expect(stateSnapshot.activeSessions.length).toBe(3);
  });

  it("should track session errors with timestamps", () => {
    const state = {
      activeSessionIds: new Set<bigint>(),
      sessionErrors: new Map<bigint, {error: Error; timestamp: Date}>([
        [1n, {error: new Error("Test error"), timestamp: new Date()}],
      ]),
    };

    const stateSnapshot = getOrchestratorState(state);
    expect(stateSnapshot.errorLog.length).toBe(1);
    expect(stateSnapshot.errorLog[0]!.sessionId).toBe(1n);
    expect(stateSnapshot.errorLog[0]!.error).toBe("Test error");
    expect(stateSnapshot.errorLog[0]!.timestamp).toBeInstanceOf(Date);
  });

  it("should maintain separate error logs for multiple sessions", () => {
    const state = {
      activeSessionIds: new Set<bigint>(),
      sessionErrors: new Map<bigint, {error: Error; timestamp: Date}>([
        [1n, {error: new Error("Error 1"), timestamp: new Date()}],
        [2n, {error: new Error("Error 2"), timestamp: new Date()}],
        [3n, {error: new Error("Error 3"), timestamp: new Date()}],
      ]),
    };

    const stateSnapshot = getOrchestratorState(state);
    expect(stateSnapshot.errorLog.length).toBe(3);
    expect(stateSnapshot.errorLog.map((e) => e.error)).toEqual([
      "Error 1",
      "Error 2",
      "Error 3",
    ]);
  });
});
