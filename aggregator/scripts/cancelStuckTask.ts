/**
 * Cancel a stuck fine-tuning task using AGG_EVM_KEY directly.
 *
 * Usage:
 *   cd aggregator
 *   npx tsx scripts/cancelStuckTask.ts --task=af75e14f-fd9d-41e7-aabe-5869aab330bb
 *   npx tsx scripts/cancelStuckTask.ts                 # cancels ALL non-terminal tasks for the configured provider
 *
 * Provider defaults to FT_PROVIDER_ADDRESS from .env; override with --provider=0x...
 */

import {readFileSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {JsonRpcProvider, Wallet} from "ethers";

const require = createRequire(join(process.cwd(), "package.json"));
const {
  CONTRACT_ADDRESSES,
  createZGComputeNetworkBroker,
  createFineTuningBroker,
} = require("@0gfoundation/0g-compute-ts-sdk") as {
  CONTRACT_ADDRESSES: {
    mainnet: {fineTuning: string};
    testnet: {fineTuning: string};
    hardhat: {fineTuning: string};
  };
  createZGComputeNetworkBroker: (signer: Wallet) => Promise<{
    ledger: unknown;
    fineTuning?: FineTuningLike;
  }>;
  createFineTuningBroker: (
    signer: Wallet,
    contractAddress: string,
    ledger: unknown
  ) => Promise<FineTuningLike>;
};

interface FineTuningLike {
  listTask(providerAddress: string): Promise<Array<{id?: string; progress?: string}>>;
  cancelTask(providerAddress: string, taskId: string): Promise<string>;
}

function loadDotEnv(): Record<string, string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", ".env");
  const out: Record<string, string> = {};
  try {
    const text = readFileSync(envPath, "utf8");
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    /* no .env — fine */
  }
  return out;
}

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

function isTerminal(progress: string | undefined): boolean {
  return progress === "Finished" || progress === "Failed" || progress === "Cancelled";
}

function fineTuningContractForChain(chainId: bigint): string {
  if (process.env.FT_CONTRACT_ADDRESS) return process.env.FT_CONTRACT_ADDRESS;
  if (chainId === 16661n) return CONTRACT_ADDRESSES.mainnet.fineTuning;
  if (chainId === 16602n) return CONTRACT_ADDRESSES.testnet.fineTuning;
  return CONTRACT_ADDRESSES.hardhat.fineTuning;
}

async function main() {
  const env = {...loadDotEnv(), ...process.env};
  const rawKey = env.AGG_EVM_KEY;
  if (!rawKey?.startsWith("0x")) {
    console.error("AGG_EVM_KEY missing or invalid in .env");
    process.exit(1);
  }

  const rpcUrl = env.FT_RPC_URL ?? "https://evmrpc.0g.ai";
  const providerAddress = flag("provider") ?? env.FT_PROVIDER_ADDRESS;
  if (!providerAddress) {
    console.error("Provider address missing — pass --provider=0x... or set FT_PROVIDER_ADDRESS");
    process.exit(1);
  }

  const desiredTaskId = flag("task");

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(rawKey as `0x${string}`, provider);
  console.log(`Signing as:      ${wallet.address}`);
  console.log(`Provider:        ${providerAddress}`);

  const broker = await createZGComputeNetworkBroker(wallet);
  const network = await provider.getNetwork();
  const ft: FineTuningLike =
    broker.fineTuning ??
    (await createFineTuningBroker(
      wallet,
      fineTuningContractForChain(network.chainId),
      broker.ledger
    ));

  const tasks = await ft.listTask(providerAddress);
  const targets = desiredTaskId
    ? tasks.filter((t) => t.id === desiredTaskId)
    : tasks.filter((t) => !isTerminal(t.progress));

  if (targets.length === 0) {
    console.log(
      desiredTaskId
        ? `No task with id ${desiredTaskId} found on this provider.`
        : "No non-terminal tasks to cancel."
    );
    return;
  }

  console.log(`Cancelling ${targets.length} task(s):`);
  for (const t of targets) {
    console.log(`  - ${t.id} (status: ${t.progress ?? "unknown"})`);
  }

  for (const t of targets) {
    if (!t.id) continue;
    try {
      const txHash = await ft.cancelTask(providerAddress, t.id);
      console.log(`  ✓ ${t.id} cancelled — tx ${txHash}`);
    } catch (err) {
      console.error(`  ✗ ${t.id} failed: ${(err as Error).message}`);
    }
  }

  console.log("Re-listing tasks for verification:");
  const after = await ft.listTask(providerAddress);
  for (const t of after) {
    if (targets.some((target) => target.id === t.id)) {
      console.log(`  - ${t.id} now: ${t.progress ?? "unknown"}`);
    }
  }
}

main().catch((err) => {
  console.error("[cancelStuckTask] Failed:", err);
  process.exit(1);
});
