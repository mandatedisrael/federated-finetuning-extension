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

export interface OrchestratorConfig {
  /** Aggregator configuration (loaded from env) */
  config: ReturnType<typeof loadConfig>;
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
}

/**
 * Start the Aggregator orchestrator.
 * Listens for QuorumReached events and runs the full pipeline per session.
 *
 * @param config Orchestrator configuration
 * @returns Stop function to halt the orchestrator
 */
export function startOrchestrator(config: OrchestratorConfig): () => void {
  const state: OrchestratorState = {
    activeSessionIds: new Set(),
    sessionErrors: new Map(),
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
      await handleQuorumReachedEvent(payload, config, state);
    }
  );

  // Return stop function
  return () => {
    console.log("[Orchestrator] Stopping...");
    eventListenerController.abort();
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

  try {
    console.log(
      `[Orchestrator] Processing QuorumReached for session ${sessionId} (${payload.submitters.length} submitters)`
    );

    // A.3: Download and decrypt blobs
    console.log(`[Orchestrator] A.3: Downloading and decrypting blobs for session ${sessionId}`);
    const blobResult = await processBlobsToJsonl(
      payload.blobHashes,
      payload.ownerPubkeys,
      {
        storageIndexerUrl: config.config.storageIndexerUrl,
        aggregatorPrivateKey: config.config.x25519PrivateKey,
        sessionId,
        tempDir: config.config.tempDir,
      }
    );

    try {
      // A.4: Train LoRA adapter
      console.log(
        `[Orchestrator] A.4: Training LoRA adapter for session ${sessionId} (${blobResult.blobCount} blobs)`
      );
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
      });

      // A.5: Mint INFT
      console.log(
        `[Orchestrator] A.5: Minting INFT for session ${sessionId} (AES key: ${trainingResult.aesKey.length} bytes)`
      );
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
      });

      console.log(`[Orchestrator] Session ${sessionId} complete: txHash=${mintResult.txHash}`);
    } finally {
      // Clean up JSONL file
      await cleanupBlobJsonl(blobResult.jsonlPath);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[Orchestrator] Session ${sessionId} failed:`, error.message);
    state.sessionErrors.set(sessionId, {
      error,
      timestamp: new Date(),
    });
  } finally {
    state.activeSessionIds.delete(sessionId);
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
