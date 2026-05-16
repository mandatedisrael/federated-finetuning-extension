import fs from "node:fs";
import path from "node:path";
import {loadConfig} from "./config.js";
import {startOrchestrator} from "./orchestrator.js";

const config = loadConfig();
const replayExistingSessions =
  (process.env.FFE_REPLAY_EXISTING_SESSIONS ?? "false").toLowerCase() === "true";
const runtimeStatusPath =
  process.env.FFE_AGGREGATOR_STATUS_PATH ?? "/tmp/ffe-aggregator-status.json";
const cancelRequestPath =
  process.env.FFE_AGGREGATOR_CANCEL_PATH ?? "/tmp/ffe-aggregator-cancellations.json";
const cancelPollIntervalMs = Number(process.env.FFE_AGGREGATOR_CANCEL_POLL_MS ?? "2000");

type RuntimeStage = "training" | "ready" | "failed";

interface RuntimeStatusFile {
  updatedAt: string;
  sessions: Record<
    string,
    {
      stage: RuntimeStage;
      updatedAt: string;
      txHash?: string;
      error?: string;
      logs?: Array<{
        message: string;
        timestamp: string;
        tone?: "info" | "success" | "warning" | "error";
        phase?: string;
      }>;
    }
  >;
}

function loadRuntimeStatus(): RuntimeStatusFile {
  try {
    const raw = fs.readFileSync(runtimeStatusPath, "utf8");
    const parsed = JSON.parse(raw) as RuntimeStatusFile;
    return {
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      sessions: {},
    };
  }
}

const runtimeStatus = loadRuntimeStatus();

function persistRuntimeStatus() {
  const directory = path.dirname(runtimeStatusPath);
  fs.mkdirSync(directory, {recursive: true});
  runtimeStatus.updatedAt = new Date().toISOString();
  const tempPath = `${runtimeStatusPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(runtimeStatus, null, 2));
  fs.renameSync(tempPath, runtimeStatusPath);
}

function updateRuntimeSession(
  sessionId: bigint,
  stage: RuntimeStage,
  details?: {error?: string; txHash?: string}
) {
  const existing = runtimeStatus.sessions[sessionId.toString()];
  runtimeStatus.sessions[sessionId.toString()] = {
    ...existing,
    stage,
    updatedAt: new Date().toISOString(),
    ...(details?.txHash ? {txHash: details.txHash} : {}),
    ...(details?.error ? {error: details.error} : {}),
  };
  persistRuntimeStatus();
}

function appendRuntimeLog(
  sessionId: bigint,
  entry: {
    message: string;
    tone?: "info" | "success" | "warning" | "error";
    phase?: string;
  }
) {
  const sessionKey = sessionId.toString();
  const existing = runtimeStatus.sessions[sessionKey];
  const logs = [
    ...(existing?.logs ?? []),
    {
      message: entry.message,
      timestamp: new Date().toISOString(),
      ...(entry.tone ? {tone: entry.tone} : {}),
      ...(entry.phase ? {phase: entry.phase} : {}),
    },
  ].slice(-24);

  runtimeStatus.sessions[sessionKey] = {
    stage: existing?.stage ?? "training",
    updatedAt: new Date().toISOString(),
    ...(existing?.txHash ? {txHash: existing.txHash} : {}),
    ...(existing?.error ? {error: existing.error} : {}),
    logs,
  };
  persistRuntimeStatus();
}

persistRuntimeStatus();

const orchestrator = startOrchestrator({
  config,
  startFromCurrent: !replayExistingSessions,
  onSessionStage: (sessionId, stage, details) => {
    updateRuntimeSession(sessionId, stage, details);
  },
  onSessionLog: (sessionId, entry) => {
    appendRuntimeLog(sessionId, entry);
  },
});

interface CancelRequestFile {
  requests: Record<string, {requestedAt: string; processedAt?: string}>;
}

function readCancelRequests(): CancelRequestFile {
  try {
    const raw = fs.readFileSync(cancelRequestPath, "utf8");
    const parsed = JSON.parse(raw) as CancelRequestFile;
    return {requests: parsed.requests ?? {}};
  } catch {
    return {requests: {}};
  }
}

function persistCancelRequests(file: CancelRequestFile) {
  const directory = path.dirname(cancelRequestPath);
  fs.mkdirSync(directory, {recursive: true});
  const tempPath = `${cancelRequestPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(file, null, 2));
  fs.renameSync(tempPath, cancelRequestPath);
}

const cancelPoll = setInterval(() => {
  const file = readCancelRequests();
  let dirty = false;
  for (const [sessionIdStr, entry] of Object.entries(file.requests)) {
    if (entry.processedAt) continue;
    let sessionId: bigint;
    try {
      sessionId = BigInt(sessionIdStr);
    } catch {
      continue;
    }
    const cancelled = orchestrator.cancelSession(sessionId);
    if (cancelled) {
      console.log(`[Aggregator] Cancellation accepted for session ${sessionIdStr}`);
      file.requests[sessionIdStr] = {...entry, processedAt: new Date().toISOString()};
      dirty = true;
    } else if (!orchestrator.state.activeSessionIds.has(sessionId)) {
      // session is not active here — mark as processed so we stop checking
      file.requests[sessionIdStr] = {...entry, processedAt: new Date().toISOString()};
      dirty = true;
    }
  }
  if (dirty) {
    try {
      persistCancelRequests(file);
    } catch (err) {
      console.warn("[Aggregator] Failed to persist cancel-request file:", err);
    }
  }
}, cancelPollIntervalMs);

console.log("[Aggregator] Service is running");
console.log(`[Aggregator] Runtime status file: ${runtimeStatusPath}`);
console.log(`[Aggregator] Cancel request file: ${cancelRequestPath}`);

function shutdown(signal: string) {
  console.log(`[Aggregator] Received ${signal}, stopping`);
  clearInterval(cancelPoll);
  orchestrator.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
