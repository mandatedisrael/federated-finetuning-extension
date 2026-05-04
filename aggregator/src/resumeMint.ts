/**
 * Retry only the INFT mint step from a saved mint checkpoint.
 *
 * This is useful when real 0G fine-tuning completed and the encrypted LoRA
 * was uploaded, but the mint transaction failed after that point.
 */

import {readFile, writeFile} from "fs/promises";
import {join} from "path";
import {type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {inft, storage} from "@notmartin/ffe";
import {loadConfig} from "./config.js";

interface MintCheckpoint {
  version: number;
  sessionId: string;
  loraBlobHash: Hex;
  contributors: Address[];
  sealedKeys: {
    contributor: Address;
    sealedKey: Hex;
  }[];
}

function asMintCheckpoint(value: unknown): MintCheckpoint {
  const checkpoint = value as Partial<MintCheckpoint>;
  if (
    checkpoint.version !== 1 ||
    typeof checkpoint.sessionId !== "string" ||
    typeof checkpoint.loraBlobHash !== "string" ||
    !Array.isArray(checkpoint.contributors) ||
    !Array.isArray(checkpoint.sealedKeys)
  ) {
    throw new Error("Invalid mint checkpoint file");
  }
  if (checkpoint.contributors.length !== checkpoint.sealedKeys.length) {
    throw new Error("Mint checkpoint contributor/sealedKey length mismatch");
  }
  return checkpoint as MintCheckpoint;
}

async function main() {
  const checkpointPath =
    process.argv.slice(2).find((arg) => arg !== "--") ||
    process.env.FFE_MINT_CHECKPOINT;
  if (!checkpointPath) {
    throw new Error("Usage: pnpm mint:resume -- output/ffe-mint-session-<id>.json");
  }

  const config = loadConfig();
  const checkpoint = asMintCheckpoint(
    JSON.parse(await readFile(checkpointPath, "utf8"))
  );
  const sessionId = BigInt(checkpoint.sessionId);
  const account = privateKeyToAccount(config.evmPrivateKey);

  const localBlobPath = join(config.localStorageDir, `${checkpoint.loraBlobHash}.bin`);
  if (process.env.FFE_RESUME_REUPLOAD_LOCAL !== "false") {
    try {
      const encryptedLora = new Uint8Array(await readFile(localBlobPath));
      console.log(`[MintResume] Re-uploading local LoRA fallback to real 0G Storage...`);
      const storageClient = new storage.ZeroGStorage({
        privateKey: config.evmPrivateKey,
        evmRpc: config.rpcUrl,
        indexerRpc: config.storageIndexerUrl,
        uploadOptions: {
          taskSize: Number(process.env.FFE_LORA_UPLOAD_TASK_SIZE || "16"),
        },
        retryOptions: {
          Retries: 10,
          Interval: 5,
          MaxGasPrice: 0,
          TooManyDataRetries: 8,
        },
      });
      const upload = await storageClient.upload(encryptedLora);
      checkpoint.loraBlobHash = upload.rootHash;
      await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
      console.log(`[MintResume] Real 0G LoRA blob: ${checkpoint.loraBlobHash}`);
      console.log(`[MintResume] Checkpoint updated: ${checkpointPath}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  const minterClient = inft.createINFTMinterClient({
    address: config.inftMinterAddress,
    rpcUrl: config.rpcUrl,
    account,
  });

  console.log(`[MintResume] INFT: ${config.inftMinterAddress}`);
  console.log(`[MintResume] Aggregator: ${account.address}`);
  console.log(`[MintResume] Session: ${sessionId}`);

  if (await minterClient.hasMinted(sessionId)) {
    const tokenId = await minterClient.getTokenBySession(sessionId);
    console.log(`[MintResume] Session already minted as token ${tokenId}`);
    return;
  }

  const txHash = await minterClient.mint({
    sessionId,
    modelBlobHash: checkpoint.loraBlobHash,
    contributors: checkpoint.contributors,
    sealedKeys: checkpoint.sealedKeys.map((s) => s.sealedKey),
  });
  console.log(`[MintResume] Mint transaction: ${txHash}`);

  const receipt = await minterClient.publicClient.waitForTransactionReceipt({hash: txHash});
  if (receipt.status !== "success") {
    throw new Error(`Mint transaction reverted: ${txHash}`);
  }

  const tokenId = await minterClient.getTokenBySession(sessionId);
  console.log(`[MintResume] Token: ${tokenId}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[MintResume] Failed: ${message}`);
  process.exit(1);
});
