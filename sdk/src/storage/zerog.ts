import {mkdir, writeFile, readFile} from "fs/promises";
import {join} from "path";
import {Indexer, MemData} from "@0gfoundation/0g-ts-sdk";
import {ethers} from "ethers";
import {keccak256, type Hex} from "viem";
import {FFEError} from "../errors.js";

/**
 * Default 0G mainnet endpoints for storage uploads.
 *
 * - `evmRpc` drives the on-chain flow transaction (storage fee payment).
 * - `indexerRpc` selects storage nodes for actual data sharding.
 *
 * When mainnet storage is unavailable, ZeroGStorage falls back to local
 * file storage if `localFallbackDir` is configured.
 */
export const ZEROG_TESTNET_EVM_RPC = "https://evmrpc.0g.ai" as const;
export const ZEROG_TESTNET_INDEXER_RPC = "https://indexer-storage-standard.0g.ai" as const;

export interface ZeroGStorageOptions {
    /** EVM RPC URL that pays the on-chain upload registration. Defaults to 0G mainnet. */
    evmRpc?: string;
    /** 0G storage indexer URL. Defaults to the public mainnet indexer. */
    indexerRpc?: string;
    /**
     * Private key (hex string, 0x-prefixed) of the wallet paying upload gas.
     * Required for `upload`. Not needed for `download`.
     */
    privateKey?: Hex | string;
    /**
     * Override the ethers signer directly. If provided, `privateKey` and
     * `evmRpc` are ignored on the signer side.
     */
    signer?: ethers.Signer;
    /**
     * Local directory used as fallback storage when 0G upload/download fails.
     * Files are stored as `<dir>/<keccak256(content)>.bin`.
     * On a single machine (demo/dev), all participants share this directory.
     */
    localFallbackDir?: string;
}

/**
 * Result of a successful upload to 0G Storage (or local fallback).
 *
 * `rootHash` is the content identifier committed on-chain via
 * `Coordinator.submit(sessionId, rootHash)`.
 * For real 0G uploads this is the Merkle root; for local fallback it is
 * keccak256 of the raw bytes — both are content-addressed 32-byte hashes.
 */
export interface UploadResult {
    rootHash: Hex;
    txHash: Hex;
    txSeq: number;
}

export class StorageError extends FFEError {
    constructor(message: string, options?: ErrorOptions) {
        super("STORAGE_FAILED", message, options);
        this.name = "StorageError";
    }
}

/**
 * Client for 0G Storage with local fallback.
 *
 * Upload: tries 0G mainnet first; if the flow contract reverts or the
 * network is unreachable, saves to `localFallbackDir` (if configured).
 * Download: tries 0G mainnet first; falls back to `localFallbackDir`.
 *
 * ```ts
 * const storage = new ZeroGStorage({
 *   privateKey: process.env.OG_KEY,
 *   localFallbackDir: '/tmp/ffe-storage',
 * });
 * const {rootHash} = await storage.upload(encryptedBytes);
 * const bytes = await storage.download(rootHash);
 * ```
 */
export class ZeroGStorage {
    readonly evmRpc: string;
    readonly indexerRpc: string;
    readonly localFallbackDir: string | undefined;
    private readonly indexer: Indexer;
    private readonly signer: ethers.Signer | undefined;

    constructor(options: ZeroGStorageOptions = {}) {
        this.evmRpc = options.evmRpc ?? ZEROG_TESTNET_EVM_RPC;
        this.indexerRpc = options.indexerRpc ?? ZEROG_TESTNET_INDEXER_RPC;
        this.localFallbackDir = options.localFallbackDir;
        this.indexer = new Indexer(this.indexerRpc);

        if (options.signer) {
            this.signer = options.signer;
        } else if (options.privateKey) {
            const provider = new ethers.JsonRpcProvider(this.evmRpc);
            this.signer = new ethers.Wallet(options.privateKey, provider);
        } else {
            this.signer = undefined;
        }
    }

    /**
     * Upload bytes. Tries 0G mainnet; falls back to local file storage on failure.
     * @throws StorageError if both 0G and local fallback are unavailable.
     */
    async upload(bytes: Uint8Array): Promise<UploadResult> {
        if (!this.signer) {
            throw new StorageError(
                "upload requires a signer — pass `privateKey` or `signer` to ZeroGStorage",
            );
        }

        try {
            return await this.uploadTo0G(bytes);
        } catch (err) {
            if (!this.localFallbackDir) {
                throw new StorageError(
                    `0G upload failed and no localFallbackDir configured: ${err instanceof Error ? err.message : String(err)}`,
                    {cause: err instanceof Error ? err : undefined},
                );
            }
            console.warn(
                `[ZeroGStorage] 0G upload failed (${err instanceof Error ? err.message : String(err)}), using local fallback`,
            );
            return await this.uploadToLocal(bytes);
        }
    }

    /**
     * Download bytes by root hash. Tries 0G mainnet; falls back to local storage.
     * @throws StorageError if the blob is not found in either location.
     */
    async download(rootHash: Hex | string): Promise<Uint8Array> {
        try {
            return await this.downloadFrom0G(rootHash);
        } catch (err) {
            if (!this.localFallbackDir) {
                throw new StorageError(
                    `0G download failed and no localFallbackDir configured: ${err instanceof Error ? err.message : String(err)}`,
                    {cause: err instanceof Error ? err : undefined},
                );
            }
            console.warn(
                `[ZeroGStorage] 0G download failed, trying local fallback for ${rootHash}`,
            );
            return await this.downloadFromLocal(rootHash as Hex);
        }
    }

    // ── private ────────────────────────────────────────────────────────────

    private async uploadTo0G(bytes: Uint8Array): Promise<UploadResult> {
        const file = new MemData(bytes);

        const [tree, mtErr] = await file.merkleTree();
        if (mtErr !== null || !tree) {
            throw new StorageError(`failed to compute merkle tree: ${mtErr?.message ?? "unknown"}`, {
                cause: mtErr ?? undefined,
            });
        }

        const [result, upErr] = await this.indexer.upload(file, this.evmRpc, this.signer!);
        if (upErr !== null) {
            throw new StorageError(`upload failed: ${upErr.message}`, {cause: upErr});
        }
        if (!result || Array.isArray((result as {rootHashes?: unknown}).rootHashes)) {
            throw new StorageError(
                "indexer returned a multi-segment upload result; small-file path expected",
            );
        }

        const single = result as {txHash: string; rootHash: string; txSeq: number};
        return {
            rootHash: single.rootHash as Hex,
            txHash: single.txHash as Hex,
            txSeq: single.txSeq,
        };
    }

    private async uploadToLocal(bytes: Uint8Array): Promise<UploadResult> {
        const rootHash = keccak256(bytes);
        await mkdir(this.localFallbackDir!, {recursive: true});
        const filePath = join(this.localFallbackDir!, `${rootHash}.bin`);
        await writeFile(filePath, bytes);
        console.log(`[ZeroGStorage] Stored locally: ${filePath}`);
        return {
            rootHash,
            txHash: ("0x" + "00".repeat(32)) as Hex,
            txSeq: 0,
        };
    }

    private async downloadFrom0G(rootHash: Hex | string): Promise<Uint8Array> {
        const [blob, err] = await this.indexer.downloadToBlob(rootHash, {proof: true});
        if (err !== null || !blob) {
            throw new StorageError(`download failed: ${err?.message ?? "no blob returned"}`, {
                cause: err ?? undefined,
            });
        }
        const buf = await blob.arrayBuffer();
        return new Uint8Array(buf);
    }

    private async downloadFromLocal(rootHash: Hex): Promise<Uint8Array> {
        const filePath = join(this.localFallbackDir!, `${rootHash}.bin`);
        try {
            const buf = await readFile(filePath);
            console.log(`[ZeroGStorage] Loaded from local fallback: ${filePath}`);
            return new Uint8Array(buf);
        } catch (err) {
            throw new StorageError(
                `blob not found locally (${rootHash}) — was it uploaded with the same localFallbackDir?`,
                {cause: err instanceof Error ? err : undefined},
            );
        }
    }
}
