/**
 * Re-acknowledge a stuck "Delivered" fine-tuning task using the TEE
 * download path only (skips 0G Storage, whose native client binary
 * is Linux-only and won't run on macOS).
 *
 * Usage:
 *   cd aggregator
 *   npx tsx scripts/retryAcknowledge.ts --task=af75e14f-fd9d-41e7-aabe-5869aab330bb
 *
 * Provider defaults to FT_PROVIDER_ADDRESS from .env; override with --provider=0x...
 * Output path for the decrypted adapter defaults to ./recovered_<taskId>.zip
 * Override with --out=/some/path.zip
 */

import {readFileSync} from "node:fs";
import {join, dirname, resolve} from "node:path";
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
  acknowledgeModel(
    providerAddress: string,
    taskId: string,
    dataPath: string,
    options?: {downloadMethod?: "tee" | "0g-storage" | "auto"}
  ): Promise<void>;
  decryptModel(
    providerAddress: string,
    taskId: string,
    encryptedPath: string,
    decryptedPath: string
  ): Promise<void>;
  getTask(providerAddress: string, taskId: string): Promise<{progress?: string} | undefined>;
  listTask(providerAddress: string): Promise<Array<{id?: string; progress?: string}>>;
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
  const taskId = flag("task");
  if (!providerAddress) {
    console.error("Missing provider — pass --provider=0x... or set FT_PROVIDER_ADDRESS");
    process.exit(1);
  }
  if (!taskId) {
    console.error("Missing task id — pass --task=<uuid>");
    process.exit(1);
  }

  const encryptedPath = resolve(flag("encrypted") ?? `./recovered_${taskId}.encrypted.bin`);
  const decryptedPath = resolve(flag("out") ?? `./recovered_${taskId}.zip`);

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(rawKey as `0x${string}`, provider);
  console.log(`Signing as:    ${wallet.address}`);
  console.log(`Provider:      ${providerAddress}`);
  console.log(`Task:          ${taskId}`);
  console.log(`Encrypted →    ${encryptedPath}`);
  console.log(`Decrypted →    ${decryptedPath}`);

  const broker = await createZGComputeNetworkBroker(wallet);
  const network = await provider.getNetwork();
  const ft: FineTuningLike =
    broker.fineTuning ??
    (await createFineTuningBroker(
      wallet,
      fineTuningContractForChain(network.chainId),
      broker.ledger
    ));

  const pre = await ft.getTask(providerAddress, taskId);
  console.log(`Current status: ${pre?.progress ?? "unknown"}`);

  console.log("Acknowledging model via TEE download path...");
  await ft.acknowledgeModel(providerAddress, taskId, encryptedPath, {downloadMethod: "tee"});
  console.log("acknowledgeModel succeeded.");

  console.log("Decrypting adapter...");
  await ft.decryptModel(providerAddress, taskId, encryptedPath, decryptedPath);
  console.log(`Decrypted adapter saved to ${decryptedPath}`);

  const post = await ft.getTask(providerAddress, taskId);
  console.log(`Final status:   ${post?.progress ?? "unknown"}`);
}

main().catch((err) => {
  console.error("[retryAcknowledge] Failed:", err);
  process.exit(1);
});
