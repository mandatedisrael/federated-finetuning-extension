import {
    bytesToHex,
    hexToBytes,
    keccak256,
    parseEventLogs,
    stringToBytes,
    type Address,
    type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {coordinatorAbi} from "./coordinator/abi.js";
import {createCoordinatorClient, type CoordinatorClient} from "./coordinator/client.js";
import {aeadDecrypt, AES_NONCE_BYTES} from "./crypto/aead.js";
import {encryptToRecipient} from "./crypto/blob.js";
import {sealedKeyFromBytes} from "./crypto/seal.js";
import {unseal} from "./crypto/seal.js";
import {createINFTMinterClient, type INFTMinterClient} from "./inft/client.js";
import {ZeroGStorage} from "./storage/zerog.js";
import {FFEError, InvalidInputError} from "./errors.js";

/* ───────── public types ───────── */

export interface FFEOptions {
    /** Hex-encoded private key (0x-prefixed) for the wallet calling the Coordinator. */
    privateKey: Hex | string;
    /** Coordinator contract address. Defaults to the deployed Galileo address. */
    coordinatorAddress?: Address;
    /** INFTMinter contract address. Defaults to the deployed Galileo address. */
    inftMinterAddress?: Address;
    /** Coordinator RPC URL. Defaults to the public Galileo endpoint. */
    rpcUrl?: string;
    /** 0G Storage EVM RPC. Defaults to Galileo. */
    storageEvmRpc?: string;
    /** 0G Storage indexer URL. Defaults to the public mainnet indexer. */
    storageIndexerRpc?: string;
    /**
     * Local directory used as fallback blob storage when 0G Storage is
     * unavailable. Blobs are stored as `<dir>/<keccak256(content)>.bin`.
     * All participants must share the same directory (single-machine demo).
     */
    localStorageFallbackDir?: string;
    /**
     * How long to wait for createSession / setAggregatorPubkey transactions
     * before giving up. Defaults to 120s.
     */
    txTimeoutMs?: number;
}

export interface ParticipantInfo {
    address: Address;
    /**
     * The participant's X25519 public key. The aggregator uses this to seal
     * the symmetric data key for them in the final INFT. Use
     * `crypto.generateKeyPair()` to produce one.
     */
    publicKey: Uint8Array | Hex;
}

export interface OpenSessionOptions {
    /**
     * Base model identifier. Accepts:
     *   - a label string ("Qwen2.5-0.5B") — hashed with keccak256
     *   - a 32-byte hex string ("0x…")
     *   - a 32-byte Uint8Array
     */
    baseModel: string | Hex | Uint8Array;
    participants: readonly ParticipantInfo[];
    /** Number of submissions required to flip the session to QuorumReached. */
    quorum: number;
    /**
     * Optional: aggregator's enclave pubkey, set in the same call. If omitted,
     * the creator must call `setAggregatorPubkey` separately before
     * contributors can submit.
     */
    aggregatorPubkey?: Uint8Array | Hex;
    /**
     * Optional: attestation quote bytes accompanying the aggregator pubkey.
     * Only meaningful when `aggregatorPubkey` is provided.
     */
    attestation?: Uint8Array | Hex;
}

export interface OpenSessionResult {
    sessionId: bigint;
    createTxHash: Hex;
    /** Present only when `openSession` also set the aggregator pubkey in one shot. */
    setAggregatorTxHash?: Hex;
}

export interface SubmitOptions {
    sessionId: bigint;
    /** Raw contributor training data bytes (e.g. JSONL). */
    data: Uint8Array;
}

export interface SubmitResult {
    /** 0G Storage Merkle root — the on-chain `blobHash` commitment. */
    rootHash: Hex;
    /** 0G on-chain storage registration tx. */
    storageTxHash: Hex;
    /** `Coordinator.submit()` tx hash. */
    submitTxHash: Hex;
}

export interface DownloadOptions {
    sessionId: bigint;
    /**
     * The contributor's X25519 private key — used to unseal the data key
     * stored in the INFTMinter. Must match the pubkey registered at session
     * creation via `openSession({ participants: [{ publicKey }] })`.
     */
    recipientPrivateKey: Uint8Array | Hex;
}

export interface DownloadResult {
    /** Decrypted LoRA artifact bytes. */
    data: Uint8Array;
    /** 0G Storage Merkle root of the encrypted LoRA blob. */
    modelBlobHash: Hex;
    /** The INFTMinter token ID for this session. */
    tokenId: bigint;
}

/* ───────── helpers (exported for direct unit testing) ───────── */

const BASE_MODEL_HEX = /^0x[0-9a-fA-F]{64}$/;

/** @internal — exported for testing. */
export function normalizeBaseModel(input: string | Hex | Uint8Array): Hex {
    if (input instanceof Uint8Array) {
        if (input.length !== 32) {
            throw new InvalidInputError(`baseModel bytes must be 32, got ${input.length}`);
        }
        return bytesToHex(input);
    }
    if (typeof input === "string") {
        if (BASE_MODEL_HEX.test(input)) {
            // Already a 32-byte hash. Lowercase to match keccak256 output.
            return input.toLowerCase() as Hex;
        }
        if (input.length === 0) {
            throw new InvalidInputError("baseModel string is empty");
        }
        return keccak256(stringToBytes(input));
    }
    throw new InvalidInputError("baseModel must be string label, 32-byte hex, or Uint8Array");
}

/** @internal — exported for testing. */
export function validateSubmit(opts: SubmitOptions): void {
    if (typeof opts.sessionId !== "bigint" || opts.sessionId < 0n) {
        throw new InvalidInputError("sessionId must be a non-negative bigint");
    }
    if (!(opts.data instanceof Uint8Array) || opts.data.length === 0) {
        throw new InvalidInputError("data must be a non-empty Uint8Array");
    }
}

/** @internal — exported for testing. */
export function validateDownload(opts: DownloadOptions): void {
    if (typeof opts.sessionId !== "bigint" || opts.sessionId < 0n) {
        throw new InvalidInputError("sessionId must be a non-negative bigint");
    }
    if (
        !(opts.recipientPrivateKey instanceof Uint8Array) &&
        typeof opts.recipientPrivateKey !== "string"
    ) {
        throw new InvalidInputError("recipientPrivateKey must be a Uint8Array or hex string");
    }
}

/** @internal — exported for testing. */
export function validateOpenSession(opts: OpenSessionOptions): void {
    if (opts.participants.length === 0) {
        throw new InvalidInputError("at least one participant required");
    }
    if (opts.participants.length > 0xff) {
        throw new InvalidInputError(
            `participants exceeds uint8 max (255); got ${opts.participants.length}`,
        );
    }
    if (!Number.isInteger(opts.quorum) || opts.quorum < 1 || opts.quorum > opts.participants.length) {
        throw new InvalidInputError(
            `quorum must be an integer in [1, ${opts.participants.length}], got ${opts.quorum}`,
        );
    }

    const seen = new Set<string>();
    for (const p of opts.participants) {
        const key = p.address.toLowerCase();
        if (seen.has(key)) {
            throw new InvalidInputError(`duplicate participant: ${p.address}`);
        }
        seen.add(key);
        if (
            (p.publicKey instanceof Uint8Array && p.publicKey.length === 0) ||
            (typeof p.publicKey === "string" && p.publicKey === "0x")
        ) {
            throw new InvalidInputError(`empty publicKey for participant ${p.address}`);
        }
    }

    if (opts.attestation && !opts.aggregatorPubkey) {
        throw new InvalidInputError("attestation requires aggregatorPubkey to be set in the same call");
    }
}

/* ───────── client ───────── */

/**
 * Top-level SDK entry point.
 *
 * Wires the Coordinator client + 0G Storage client behind a small ergonomic
 * surface. For finer control, drop down to `ffe.coordinator.*` or
 * `ffe.storage.*` directly — both are exposed as public fields.
 */
export class FFE {
    readonly coordinator: CoordinatorClient;
    readonly inft: INFTMinterClient;
    readonly storage: ZeroGStorage;
    readonly account: Address;
    private readonly txTimeoutMs: number;

    constructor(options: FFEOptions) {
        const account = privateKeyToAccount(options.privateKey as Hex);
        this.account = account.address;
        this.txTimeoutMs = options.txTimeoutMs ?? 120_000;

        this.coordinator = createCoordinatorClient({
            account,
            ...(options.coordinatorAddress ? {address: options.coordinatorAddress} : {}),
            ...(options.rpcUrl ? {rpcUrl: options.rpcUrl} : {}),
        });

        this.inft = createINFTMinterClient({
            account,
            ...(options.inftMinterAddress ? {address: options.inftMinterAddress} : {}),
            ...(options.rpcUrl ? {rpcUrl: options.rpcUrl} : {}),
        });

        this.storage = new ZeroGStorage({
            privateKey: options.privateKey,
            ...(options.storageEvmRpc ? {evmRpc: options.storageEvmRpc} : {}),
            ...(options.storageIndexerRpc ? {indexerRpc: options.storageIndexerRpc} : {}),
            ...(options.localStorageFallbackDir ? {localFallbackDir: options.localStorageFallbackDir} : {}),
        });
    }

    /**
     * Create a new fine-tuning session on the Coordinator.
     *
     * Submits the createSession transaction, waits for it to be mined,
     * extracts the sessionId from the SessionCreated event, and (if
     * `aggregatorPubkey` is provided) immediately publishes that pubkey.
     *
     * @throws InvalidInputError on malformed args
     * @throws CoordinatorError on contract reverts
     * @throws FFEError if the tx mines but no SessionCreated event is emitted
     */
    async openSession(opts: OpenSessionOptions): Promise<OpenSessionResult> {
        validateOpenSession(opts);

        const baseModel = normalizeBaseModel(opts.baseModel);
        const participants = opts.participants.map((p) => p.address);
        const ownerPubkeys = opts.participants.map((p) => p.publicKey);

        const createTxHash = await this.coordinator.createSession({
            baseModel,
            participants,
            ownerPubkeys,
            quorum: opts.quorum,
        });

        const receipt = await this.coordinator.publicClient.waitForTransactionReceipt({
            hash: createTxHash,
            timeout: this.txTimeoutMs,
        });

        const events = parseEventLogs({
            abi: coordinatorAbi,
            eventName: "SessionCreated",
            logs: receipt.logs,
        });
        if (events.length === 0) {
            throw new FFEError(
                "CHAIN_FAILED",
                `createSession tx ${createTxHash} mined but no SessionCreated event found`,
            );
        }

        const sessionId = events[0]!.args.sessionId;

        if (!opts.aggregatorPubkey) {
            return {sessionId, createTxHash};
        }

        const setAggregatorTxHash = await this.coordinator.setAggregatorPubkey({
            sessionId,
            pubkey: opts.aggregatorPubkey,
            attestation: opts.attestation ?? new Uint8Array(),
        });
        await this.coordinator.publicClient.waitForTransactionReceipt({
            hash: setAggregatorTxHash,
            timeout: this.txTimeoutMs,
        });

        return {sessionId, createTxHash, setAggregatorTxHash};
    }

    /**
     * Encrypt and submit a contributor's training data to the session.
     *
     * Pipeline:
     *   1. Fetch the session's aggregator pubkey from the Coordinator.
     *   2. Encrypt `data` to the aggregator using X25519 + AES-256-GCM.
     *   3. Upload the encrypted blob to 0G Storage → get `rootHash`.
     *   4. Call `Coordinator.submit(sessionId, rootHash)` and wait for the tx.
     *
     * The returned `rootHash` is both the storage identifier and the on-chain
     * `blobHash` commitment. The aggregator listens for `Submitted` events and
     * downloads blobs by this hash.
     *
     * @throws InvalidInputError on malformed args
     * @throws FFEError("CHAIN_FAILED") if the aggregator pubkey is not yet set
     * @throws CoordinatorError on contract reverts
     * @throws StorageError on upload failure
     */
    async submit(opts: SubmitOptions): Promise<SubmitResult> {
        validateSubmit(opts);

        const session = await this.coordinator.getSession(opts.sessionId);
        if (session.aggregatorPubkey === "0x" || session.aggregatorPubkey.length <= 2) {
            throw new FFEError(
                "CHAIN_FAILED",
                `session ${opts.sessionId} has no aggregator pubkey — call setAggregatorPubkey first`,
            );
        }

        const aggPubkeyBytes = hexToBytes(session.aggregatorPubkey);
        const blob = encryptToRecipient(opts.data, aggPubkeyBytes);

        const upload = await this.storage.upload(blob.bytes);

        const submitTxHash = await this.coordinator.submit({
            sessionId: opts.sessionId,
            blobHash: upload.rootHash,
        });
        await this.coordinator.publicClient.waitForTransactionReceipt({
            hash: submitTxHash,
            timeout: this.txTimeoutMs,
        });

        return {
            rootHash: upload.rootHash,
            storageTxHash: upload.txHash,
            submitTxHash,
        };
    }

    /**
     * Download and decrypt the trained LoRA artifact for a completed session.
     *
     * Pipeline:
     *   1. Resolve sessionId → tokenId via INFTMinter.
     *   2. Fetch this contributor's sealedKey bytes from the INFTMinter.
     *   3. Deserialize the SealedKey and unseal the data key using the
     *      contributor's X25519 private key.
     *   4. Fetch the encrypted LoRA blob from 0G Storage.
     *   5. Decrypt: blob layout is `nonce(12B) || ciphertext` (AES-256-GCM).
     *
     * @throws InvalidInputError on malformed opts
     * @throws FFEError("NOT_FOUND") if no INFT exists for this session, or
     *         this contributor has no sealedKey in the token
     * @throws DecryptionFailedError if the data key or ciphertext is wrong
     * @throws StorageError on download failure
     */
    async download(opts: DownloadOptions): Promise<DownloadResult> {
        validateDownload(opts);

        const recipientPrivKey =
            opts.recipientPrivateKey instanceof Uint8Array
                ? opts.recipientPrivateKey
                : hexToBytes(opts.recipientPrivateKey as Hex);

        // 1. Resolve tokenId
        const tokenId = await this.inft.getTokenBySession(opts.sessionId);

        // 2. Fetch sealedKey for this account
        const sealedKeyHex = await this.inft.getSealedKey(tokenId, this.account);
        if (!sealedKeyHex || sealedKeyHex === "0x" || sealedKeyHex.length <= 2) {
            throw new FFEError(
                "NOT_FOUND",
                `no sealed key for ${this.account} in INFTMinter token ${tokenId}`,
            );
        }

        // 3. Unseal the data key
        const sealedKey = sealedKeyFromBytes(hexToBytes(sealedKeyHex));
        const dataKey = unseal(sealedKey, recipientPrivKey);

        // 4. Fetch encrypted LoRA
        const record = await this.inft.getMintRecord(tokenId);
        const encryptedLora = await this.storage.download(record.modelBlobHash);

        // 5. Decrypt: nonce(12) || ciphertext
        if (encryptedLora.length <= AES_NONCE_BYTES) {
            throw new FFEError(
                "STORAGE_FAILED",
                "downloaded LoRA blob is too short to contain AES nonce",
            );
        }
        const nonce = encryptedLora.slice(0, AES_NONCE_BYTES);
        const ciphertext = encryptedLora.slice(AES_NONCE_BYTES);
        const data = aeadDecrypt(dataKey, {nonce, ciphertext});

        return {data, modelBlobHash: record.modelBlobHash, tokenId};
    }
}
