/**
 * Inspect the aggregator's EVM identity.
 *
 *   1. Loads AGG_EVM_KEY from aggregator/.env
 *   2. Derives the address from the private key
 *   3. Queries the 0G RPC for native balance
 *   4. Queries the 0G compute ledger for available funds
 *   5. Optionally compares against the wallet that `0g-compute-cli` is
 *      currently using (set ZG_CLI_ADDRESS env var or pass --cli=0x...)
 *
 * Usage:
 *   cd aggregator
 *   npx tsx scripts/checkWallet.ts
 *   npx tsx scripts/checkWallet.ts --cli=0xabc...
 */

import {readFileSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {JsonRpcProvider, Wallet, formatEther} from "ethers";

interface FineTuningAccount {
  balance: bigint;
  pendingRefund: bigint;
  acknowledged: boolean;
  deliverablesCount: bigint;
  refunds: Array<{amount: bigint; remainTime: bigint}>;
}

interface ComputeBroker {
  ledger: {
    getLedger(): Promise<{
      totalBalance?: bigint;
      availableBalance?: bigint;
      locked?: bigint;
    }>;
  };
  fineTuning?: {
    getAccount(providerAddress: string): Promise<FineTuningAccount>;
    getAccountWithDetail(
      providerAddress: string
    ): Promise<{
      account: FineTuningAccount;
      refunds: Array<{amount: bigint; remainTime: bigint}>;
    }>;
    listTask(providerAddress: string): Promise<Array<{id?: string; progress?: string}>>;
  };
}

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
  createZGComputeNetworkBroker: (signer: Wallet) => Promise<ComputeBroker>;
  createFineTuningBroker: (
    signer: Wallet,
    contractAddress: string,
    ledger: ComputeBroker["ledger"]
  ) => Promise<NonNullable<ComputeBroker["fineTuning"]>>;
};

function fineTuningContractForChain(chainId: bigint): string {
  if (process.env.FT_CONTRACT_ADDRESS) return process.env.FT_CONTRACT_ADDRESS;
  if (chainId === 16661n) return CONTRACT_ADDRESSES.mainnet.fineTuning;
  if (chainId === 16602n) return CONTRACT_ADDRESSES.testnet.fineTuning;
  return CONTRACT_ADDRESSES.hardhat.fineTuning;
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
  } catch (err) {
    console.warn(`[checkWallet] Could not read ${envPath}:`, (err as Error).message);
  }
  return out;
}

function parseCliFlag(): string | undefined {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--cli=")) return arg.slice("--cli=".length);
  }
  return process.env.ZG_CLI_ADDRESS;
}

function parseProviderFlags(envProvider?: string): string[] {
  const providers = new Set<string>();
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--provider=")) providers.add(arg.slice("--provider=".length));
  }
  if (providers.size === 0 && envProvider) providers.add(envProvider);
  return [...providers];
}

async function main() {
  const env = {...loadDotEnv(), ...process.env};

  const rawKey = env.AGG_EVM_KEY;
  if (!rawKey) {
    console.error("AGG_EVM_KEY is not set in .env or environment.");
    process.exit(1);
  }
  if (!rawKey.startsWith("0x") || rawKey.length !== 66) {
    console.error(
      `AGG_EVM_KEY does not look like a 0x-prefixed 32-byte hex string (got length ${rawKey.length}).`
    );
    process.exit(1);
  }

  const rpcUrl = env.FT_RPC_URL ?? "https://evmrpc.0g.ai";
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(rawKey, provider);

  console.log("─────────────────────────────────────────────");
  console.log("FFE Aggregator — wallet inspector");
  console.log("─────────────────────────────────────────────");
  console.log(`RPC URL:           ${rpcUrl}`);
  console.log(`AGG wallet:        ${wallet.address}`);

  let network: {chainId: bigint; name: string} | undefined;
  try {
    const n = await provider.getNetwork();
    network = {chainId: n.chainId, name: n.name};
    console.log(`Chain ID:          ${n.chainId.toString()} (${n.name || "unknown"})`);
  } catch (err) {
    console.warn(`Could not fetch network: ${(err as Error).message}`);
  }

  try {
    const bal = await provider.getBalance(wallet.address);
    console.log(`Native balance:    ${formatEther(bal)} (0G)`);
    if (bal === 0n) {
      console.log("  WARNING: zero native balance — wallet cannot pay gas.");
    }
  } catch (err) {
    console.warn(`Could not fetch native balance: ${(err as Error).message}`);
  }

  let broker: ComputeBroker | undefined;
  try {
    broker = await createZGComputeNetworkBroker(wallet);
    const ledger = await broker.ledger.getLedger();
    const total = ledger.totalBalance ?? 0n;
    const locked = ledger.locked ?? 0n;
    const available = ledger.availableBalance ?? total - locked;
    console.log("Compute ledger:");
    console.log(`  total:           ${formatEther(total)}`);
    console.log(`  locked:          ${formatEther(locked)}`);
    console.log(`  available:       ${formatEther(available)}`);
    if (available === 0n) {
      console.log(
        "  WARNING: ledger has no available funds. Top up with " +
          "`0g-compute-cli deposit --amount <0G>` using the SAME private key."
      );
    }
  } catch (err) {
    console.warn(`Could not query compute ledger: ${(err as Error).message}`);
    console.warn(
      "  This usually means the wallet has no ledger account yet — create one via " +
        "`0g-compute-cli add-account --amount <0G>`."
    );
  }

  const providerAddresses = parseProviderFlags(env.FT_PROVIDER_ADDRESS);

  let ft = broker?.fineTuning;
  if (!ft && broker && providerAddresses.length > 0 && network) {
    try {
      ft = await createFineTuningBroker(
        wallet,
        fineTuningContractForChain(network.chainId),
        broker.ledger
      );
    } catch (err) {
      console.warn(`Could not create fine-tuning broker: ${(err as Error).message}`);
    }
  }

  if (ft && providerAddresses.length > 0) {
    console.log("─────────────────────────────────────────────");
    console.log("Fine-tuning sub-accounts:");
    for (const providerAddr of providerAddresses) {
      console.log(`  provider: ${providerAddr}`);
      try {
        const detail = await ft.getAccountWithDetail(providerAddr);
        const acc = detail.account;
        console.log(`    balance:           ${formatEther(acc.balance ?? 0n)}`);
        console.log(`    pendingRefund:     ${formatEther(acc.pendingRefund ?? 0n)}`);
        console.log(`    deliverablesCount: ${(acc.deliverablesCount ?? 0n).toString()}`);
        console.log(`    acknowledged:      ${acc.acknowledged}`);
        if (detail.refunds.length > 0) {
          console.log(`    pending refunds:`);
          for (const r of detail.refunds) {
            console.log(
              `      - amount ${formatEther(r.amount)} | remainTime ${r.remainTime.toString()}s`
            );
          }
        }
        const spendable = (acc.balance ?? 0n) - (acc.pendingRefund ?? 0n);
        if (spendable <= 0n) {
          console.log(
            "    WARNING: sub-account is empty. Transfer funds with " +
              `\`0g-compute-cli transfer-fund --provider ${providerAddr} --service-type-name fine-tuning --amount <0G>\`.`
          );
        } else {
          console.log(`    spendable:         ${formatEther(spendable)}`);
        }
        try {
          const tasks = await ft.listTask(providerAddr);
          const unfinished = tasks.filter(
            (t) =>
              t.progress !== "Finished" && t.progress !== "Failed" && t.progress !== "Cancelled"
          );
          if (unfinished.length > 0) {
            console.log(`    unfinished tasks:`);
            for (const t of unfinished) {
              console.log(`      - ${t.id ?? "(no id)"} status=${t.progress ?? "unknown"}`);
            }
          }
        } catch (err) {
          // listTask may need provider acknowledgement first; just skip
          void err;
        }
      } catch (err) {
        console.warn(`    Could not fetch sub-account: ${(err as Error).message}`);
      }
    }
  } else if (ft && providerAddresses.length === 0) {
    console.log(
      "(no provider given — pass --provider=0x... or set FT_PROVIDER_ADDRESS in .env to inspect a fine-tuning sub-account)"
    );
  }

  const cliAddress = parseCliFlag();
  if (cliAddress) {
    const norm = cliAddress.toLowerCase();
    const agg = wallet.address.toLowerCase();
    console.log("─────────────────────────────────────────────");
    console.log(`0g-compute-cli wallet: ${cliAddress}`);
    if (norm === agg) {
      console.log("MATCH — aggregator and CLI use the same wallet.");
    } else {
      console.log("MISMATCH — aggregator and CLI use DIFFERENT wallets.");
      console.log(
        "Any ledger top-up you did via the CLI will not be visible to the aggregator."
      );
    }
  } else {
    console.log("─────────────────────────────────────────────");
    console.log(
      "Tip: to compare with the 0g-compute-cli wallet, run:\n" +
        "  0g-compute-cli get-account   # prints the CLI wallet address\n" +
        "  npx tsx scripts/checkWallet.ts --cli=0x<that-address>"
    );
  }

  void network;
}

main().catch((err) => {
  console.error("[checkWallet] Failed:", err);
  process.exit(1);
});
