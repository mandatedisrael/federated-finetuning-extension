/**
 * Main orchestrator for the Aggregator.
 * Wires event listener, blob processor, training bridge, and minter in a loop.
 */

import {type Address} from "viem";
import {
  loadConfig,
  startEventListener,
  type QuorumReachedPayload,
  processBlobsToJsonl,
  cleanupBlobJsonl,
  trainLoraAdapter,
  mintLoraNFT,
  type MintingPayload,
} from "./index.js";
import {TrainingCancelledError} from "./trainingBridge.js";

export interface OrchestratorConfig {
  /** Aggregator configuration (loaded from env) */
  config: ReturnType<typeof loadConfig>;
  /** Skip sessions that already existed when the service started */
  startFromCurrent?: boolean;
  /** Optional session allow-list for one-shot runners */
  targetSessionId?: bigint;
  /** Optional failure hook for one-shot runners */
  onSessionError?: (sessionId: bigint, error: Error) => void;
  /** Optional runtime stage hook for dashboards or local status bridges */
  onSessionStage?: (
    sessionId: bigint,
    stage: "training" | "ready" | "failed",
    details?: { error?: string; txHash?: string }
  ) => void;
  onSessionLog?: (
    sessionId: bigint,
    entry: {
      message: string;
      tone?: "info" | "success" | "warning" | "error";
      phase?: string;
    }
  ) => void;
}

export interface OrchestratorState {
  /** Sessions currently being processed */
  activeSessionIds: Set<bigint>;
  /** Error log for per-session errors */
  sessionErrors: Map<
    bigint,
    {
      error: Error;
      timestamp: Date;
    }
  >;
  /** Abort controllers for owner-triggered session cancellation */
  cancelControllers?: Map<bigint, AbortController>;
}

export interface OrchestratorHandle {
  /** Stop the event listener and tear down the orchestrator. */
  stop: () => void;
  /** Request cancellation of an in-flight session. Returns true if the session was active. */
  cancelSession: (sessionId: bigint) => boolean;
  /** Snapshot of current state. */
  state: OrchestratorState;
}

/**
 * Start the Aggregator orchestrator.
 * Listens for QuorumReached events and runs the full pipeline per session.
 *
 * @param config Orchestrator configuration
 * @returns Stop function to halt the orchestrator
 */
export function startOrchestrator(config: OrchestratorConfig): OrchestratorHandle {
  const state: OrchestratorState = {
    activeSessionIds: new Set(),
    sessionErrors: new Map(),
    cancelControllers: new Map(),
  };

  console.log(
    `[Orchestrator] Starting aggregator service (address: ${config.config.coordinatorAddress})`
  );

  // Start the event listener
  const eventListenerController = startEventListener(
    config.config.coordinatorAddress as Address,
    config.config.rpcUrl,
    config.config.pollIntervalMs,
    async (payload: QuorumReachedPayload) => {
      if (config.targetSessionId !== undefined && payload.sessionId !== config.targetSessionId) {
        return;
      }
      await handleQuorumReachedEvent(payload, config, state);
    },
    config.startFromCurrent !== undefined
      ? {startFromCurrent: config.startFromCurrent}
      : undefined
  );

  return {
    stop: () => {
      console.log("[Orchestrator] Stopping...");
      eventListenerController.abort();
      for (const controller of state.cancelControllers?.values() ?? []) {
        controller.abort();
      }
    },
    cancelSession: (sessionId: bigint) => {
      const controller = state.cancelControllers?.get(sessionId);
      if (!controller) return false;
      console.log(`[Orchestrator] Cancellation requested for session ${sessionId}`);
      controller.abort();
      return true;
    },
    state,
  };
}

/**
 * Handle a QuorumReached event by running the full pipeline.
 */
async function handleQuorumReachedEvent(
  payload: QuorumReachedPayload,
  config: OrchestratorConfig,
  state: OrchestratorState
): Promise<void> {
  const {sessionId} = payload;
  const emitLog = (
    message: string,
    options?: {tone?: "info" | "success" | "warning" | "error"; phase?: string}
  ) =>
    config.onSessionLog?.(sessionId, {
      message,
      ...(options?.tone ? {tone: options.tone} : {}),
      ...(options?.phase ? {phase: options.phase} : {}),
    });

  // Check if already processing or at concurrency limit
  if (state.activeSessionIds.has(sessionId)) {
    console.log(`[Orchestrator] Session ${sessionId} already processing, skipping`);
    return;
  }

  const maxConcurrent = config.config.maxConcurrentSessions;
  if (state.activeSessionIds.size >= maxConcurrent) {
    console.warn(
      `[Orchestrator] Max concurrent sessions (${maxConcurrent}) reached, deferring session ${sessionId}`
    );
    return;
  }

  state.activeSessionIds.add(sessionId);
  const cancelController = new AbortController();
  state.cancelControllers?.set(sessionId, cancelController);

  try {
    console.log(
      `[Orchestrator] Processing QuorumReached for session ${sessionId} (${payload.submitters.length} submitters)`
    );
    config.onSessionStage?.(sessionId, "training");
    emitLog("Quorum reached. The aggregator has accepted this session for training.", {
      phase: "quorum",
    });

    // A.3: Download and decrypt blobs
    console.log(`[Orchestrator] A.3: Downloading and decrypting blobs for session ${sessionId}`);
    emitLog("Downloading encrypted contributor blobs.", {phase: "download"});
    const blobResult = await processBlobsToJsonl(
      payload.blobHashes,
      payload.ownerPubkeys,
      {
        storageIndexerUrl: config.config.storageIndexerUrl,
        aggregatorPrivateKey: config.config.x25519PrivateKey,
        sessionId,
        tempDir: config.config.tempDir,
        localStorageDir: config.config.localStorageDir,
      }
    );
    emitLog(`Decrypted ${blobResult.blobCount} contributor blob(s) into a shared JSONL dataset.`, {
      phase: "download",
      tone: "success",
    });

    try {
      // A.4: Train LoRA adapter
      console.log(
        `[Orchestrator] A.4: Training LoRA adapter for session ${sessionId} (${blobResult.blobCount} blobs)`
      );
      emitLog("Starting the shared 0G fine-tuning run.", {phase: "training"});
      const trainingResult = await trainLoraAdapter({
        jsonlPath: blobResult.jsonlPath,
        baseModel: config.config.baseModel,
        sessionId,
        tempDir: config.config.tempDir,
        timeoutMs: config.config.trainingTimeoutMs,
        useReal0GTraining: config.config.useReal0GTraining,
        evmPrivateKey: config.config.evmPrivateKey,
        ftRpcUrl: config.config.ftRpcUrl,
        ftProviderAddress: config.config.ftProviderAddress,
        cancelSignal: cancelController.signal,
        onLog: (entry) =>
          emitLog(entry.message, {
            ...(entry.tone ? {tone: entry.tone} : {}),
            ...(entry.phase ? {phase: entry.phase} : {}),
          }),
      });
      if (cancelController.signal.aborted) {
        throw new TrainingCancelledError();
      }
      emitLog("Training completed. Preparing the encrypted adapter for minting.", {
        phase: "training",
        tone: "success",
      });

      // A.5: Mint INFT
      console.log(
        `[Orchestrator] A.5: Minting INFT for session ${sessionId} (AES key: ${trainingResult.aesKey.length} bytes)`
      );
      emitLog("Uploading the trained adapter and minting the shared artifact.", {
        phase: "mint",
      });
      const mintingPayload: MintingPayload = {
        sessionId,
        encryptedLoraAdapter: trainingResult.encryptedAdapter,
        adapterAESKey: trainingResult.aesKey,
        contributors: payload.submitters.map((addr, idx) => ({
          address: addr,
          pubkey: payload.ownerPubkeys[idx]!,
        })),
      };

      // [A.6] Mint INFT now that A.5 is implemented
      const mintResult = await mintLoraNFT(mintingPayload, {
        aggregatorEVMPrivateKey: config.config.evmPrivateKey,
        aggregatorX25519PrivateKey: config.config.x25519PrivateKey,
        inftMinterAddress: config.config.inftMinterAddress,
        rpcUrl: config.config.rpcUrl,
        storageIndexerUrl: config.config.storageIndexerUrl,
        localStorageDir: config.config.localStorageDir,
        allowLocalFallback: process.env.FFE_ALLOW_LOCAL_LORA_FALLBACK === "true",
        uploadTaskSize: Number(process.env.FFE_LORA_UPLOAD_TASK_SIZE || "16"),
        mintCheckpointPath:
          process.env.FFE_MINT_CHECKPOINT_PATH ||
          `./output/ffe-mint-session-${sessionId}.json`,
      });

      console.log(`[Orchestrator] Session ${sessionId} complete: txHash=${mintResult.txHash}`);
      emitLog("Model acknowledged. The shared artifact has been minted on-chain.", {
        phase: "mint",
        tone: "success",
      });
      config.onSessionStage?.(sessionId, "ready", {txHash: mintResult.txHash});
    } finally {
      // Clean up JSONL file
      await cleanupBlobJsonl(blobResult.jsonlPath);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const cancelled = error instanceof TrainingCancelledError;
    const message = cancelled ? "Cancelled by owner." : error.message;
    console.error(
      `[Orchestrator] Session ${sessionId} ${cancelled ? "cancelled" : "failed"}:`,
      message
    );
    state.sessionErrors.set(sessionId, {
      error: cancelled ? new Error(message) : error,
      timestamp: new Date(),
    });
    emitLog(message, {phase: cancelled ? "cancelled" : "error", tone: "error"});
    config.onSessionStage?.(sessionId, "failed", {error: message});
    config.onSessionError?.(sessionId, cancelled ? new Error(message) : error);
    if (!cancelled) throw error;
  } finally {
    state.activeSessionIds.delete(sessionId);
    state.cancelControllers?.delete(sessionId);
  }
}

/**
 * Get the current orchestrator state (for monitoring/debugging).
 */
export function getOrchestratorState(state: OrchestratorState) {
  return {
    activeSessions: Array.from(state.activeSessionIds),
    errorLog: Array.from(state.sessionErrors.entries()).map(([sessionId, {error, timestamp}]) => ({
      sessionId,
      error: error.message,
      timestamp,
    })),
  };
}
