import {Indexer, MemData} from "@0gfoundation/0g-ts-sdk";
import {ethers} from "ethers";
import type {Hex} from "viem";
import {FFEError} from "../errors.js";

/**
 * Default 0G testnet endpoints for storage uploads.
 *
 * - `evmRpc` is used by the storage SDK to write the on-chain flow
 *   transaction that registers the upload. This is the SAME EVM chain the
 *   Coordinator lives on (Galileo testnet).
 * - `indexerRpc` is the 0G storage indexer that selects storage nodes for
 *   the actual data sharding.
 */
export const ZEROG_TESTNET_EVM_RPC = "https://evmrpc-testnet.0g.ai" as const;
export const ZEROG_TESTNET_INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai" as const;

export interface ZeroGStorageOptions {
    /** EVM RPC URL that pays the on-chain upload registration. Defaults to Galileo. */
    evmRpc?: string;
    /** 0G storage indexer URL. Defaults to the public testnet indexer. */
    indexerRpc?: string;
    /**
     * Private key (hex string, 0x-prefixed) of the wallet paying upload gas.
     * Required for `upload`. Not needed for `download`.
     */
    privateKey?: Hex | string;
    /**
     * Override the ethers signer directly. If provided, `privateKey` and
     * `evmRpc` are ignored on the signer side. Useful when the wallet is
     * managed elsewhere (e.g. a browser provider).
     */
    signer?: ethers.Signer;
}

/**
 * Result of a successful upload to 0G Storage.
 *
 * `rootHash` is the Merkle root of the uploaded bytes — this is what the
 * SDK commits on-chain via `Coordinator.submit(sessionId, rootHash)`. It
 * IS the storage identifier; the aggregator listens for `Submitted`,
 * reads the hash, and downloads by it.
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
 * Concrete client for 0G Storage. No mocks — every call hits the real
 * 0G storage network.
 *
 * Upload requires a funded wallet (storage costs are paid in OG on
 * Galileo). Download is read-only and works without a wallet.
 *
 * ```ts
 * const storage = new ZeroGStorage({privateKey: process.env.OG_KEY});
 * const {rootHash, txHash} = await storage.upload(encryptedBytes);
 *
 * const bytes = await storage.download(rootHash);
 * ```
 */
export class ZeroGStorage {
    readonly evmRpc: string;
    readonly indexerRpc: string;
    private readonly indexer: Indexer;
    private readonly signer: ethers.Signer | undefined;

    constructor(options: ZeroGStorageOptions = {}) {
        this.evmRpc = options.evmRpc ?? ZEROG_TESTNET_EVM_RPC;
        this.indexerRpc = options.indexerRpc ?? ZEROG_TESTNET_INDEXER_RPC;
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
     * Upload bytes to 0G Storage. Returns the storage Merkle root (used
     * as the on-chain commitment in `Coordinator.submit`).
     *
     * @throws StorageError on signer missing, upload failure, or unexpected
     *         indexer response shape.
     */
    async upload(bytes: Uint8Array): Promise<UploadResult> {
        if (!this.signer) {
            throw new StorageError(
                "upload requires a signer — pass `privateKey` or `signer` to ZeroGStorage",
            );
        }

        const file = new MemData(bytes);

        const [tree, mtErr] = await file.merkleTree();
        if (mtErr !== null || !tree) {
            throw new StorageError(`failed to compute merkle tree: ${mtErr?.message ?? "unknown"}`, {
                cause: mtErr ?? undefined,
            });
        }

        const [result, upErr] = await this.indexer.upload(file, this.evmRpc, this.signer);
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

    /**
     * Download bytes from 0G Storage by Merkle root hash. Verifies the
     * Merkle proof during download (cannot be skipped — integrity matters).
     *
     * Returns raw bytes, not a Blob. Works without a wallet.
     *
     * @throws StorageError on download failure or empty response.
     */
    async download(rootHash: Hex | string): Promise<Uint8Array> {
        const [blob, err] = await this.indexer.downloadToBlob(rootHash, {proof: true});
        if (err !== null || !blob) {
            throw new StorageError(`download failed: ${err?.message ?? "no blob returned"}`, {
                cause: err ?? undefined,
            });
        }
        const buf = await blob.arrayBuffer();
        return new Uint8Array(buf);
    }
}
