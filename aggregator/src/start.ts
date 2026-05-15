import fs from "node:fs";
import path from "node:path";
import {loadConfig} from "./config.js";
import {startOrchestrator} from "./orchestrator.js";

const config = loadConfig();
const replayExistingSessions =
  (process.env.FFE_REPLAY_EXISTING_SESSIONS ?? "false").toLowerCase() === "true";
const runtimeStatusPath =
  process.env.FFE_AGGREGATOR_STATUS_PATH ?? "/tmp/ffe-aggregator-status.json";

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
  runtimeStatus.sessions[sessionId.toString()] = {
    stage,
    updatedAt: new Date().toISOString(),
    ...(details?.txHash ? {txHash: details.txHash} : {}),
    ...(details?.error ? {error: details.error} : {}),
  };
  persistRuntimeStatus();
}

persistRuntimeStatus();

const stop = startOrchestrator({
  config,
  startFromCurrent: !replayExistingSessions,
  onSessionStage: (sessionId, stage, details) => {
    updateRuntimeSession(sessionId, stage, details);
  },
});

console.log("[Aggregator] Service is running");
console.log(`[Aggregator] Runtime status file: ${runtimeStatusPath}`);

function shutdown(signal: string) {
  console.log(`[Aggregator] Received ${signal}, stopping`);
  stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
