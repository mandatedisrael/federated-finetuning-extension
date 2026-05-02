/**
 * FFE Aggregator
 *
 * Service that orchestrates multi-party LoRA training:
 * 1. Listens for QuorumReached events
 * 2. Downloads and decrypts contributor blobs from 0G Storage
 * 3. Trains joint LoRA via Python subprocess
 * 4. Seals data key, uploads encrypted LoRA, calls INFTMinter.mint()
 */

export { loadConfig, type AggregatorConfig } from "./config.js";
export { startEventListener, type QuorumReachedPayload } from "./eventListener.js";
export { processBlobsToJsonl, cleanupBlobJsonl, type BlobProcessorOptions, type BlobProcessResult } from "./blobProcessor.js";
export { trainLoraAdapter, killTrainingProcess, type TrainingBridgeOptions, type TrainingResult } from "./trainingBridge.js";
export { mintLoraNFT, sealDataKeyForContributor, sealedKeyToWireFormat, type MinterOptions, type MintingPayload, type MintResult } from "./minter.js";
export { startOrchestrator, getOrchestratorState, type OrchestratorConfig, type OrchestratorState } from "./orchestrator.js";
