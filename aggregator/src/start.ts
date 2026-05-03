import {loadConfig} from "./config.js";
import {startOrchestrator} from "./orchestrator.js";

const config = loadConfig();
const stop = startOrchestrator({config});

console.log("[Aggregator] Service is running");

function shutdown(signal: string) {
  console.log(`[Aggregator] Received ${signal}, stopping`);
  stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
