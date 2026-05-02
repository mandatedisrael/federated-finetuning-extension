import {
    bytesToHex,
    createPublicClient,
    createWalletClient,
    http,
    type Account,
    type Address,
    type Chain,
    type Hash,
    type Hex,
    type PublicClient,
    type Transport,
    type WalletClient,
} from "viem";
import {inftMinterAbi} from "./abi.js";
import {galileo} from "../coordinator/chain.js";
import {rethrowINFTMinterError} from "./errors.js";

/* ──────────── public types ──────────── */

export type Bytes = Uint8Array | Hex;

export interface MintRecord {
    sessionId: bigint;
    /** 0G Storage Merkle root of the AES-256-GCM-encrypted LoRA. */
    modelBlobHash: Hex;
    contributors: readonly Address[];
    mintedAt: bigint;
}

export interface INFTMinterClientOptions {
    /** INFTMinter contract address. Defaults to the deployed Galileo address. */
    address?: Address;
    /** RPC URL. Defaults to the Galileo public endpoint. */
    rpcUrl?: string;
    /** Chain config. Defaults to Galileo. */
    chain?: Chain;
    /** Optional account for write operations (aggregator only). Reads work without one. */
    account?: Account;
    /** Override the underlying viem transport (mainly for testing). */
    transport?: Transport;
}

export const GALILEO_INFT_MINTER_ADDRESS =
    "0x8c71F8176720bD0888e83B822FD7CE0164C67567" as Address;

/* ──────────── helpers ──────────── */

function asHex(value: Bytes): Hex {
    return value instanceof Uint8Array ? bytesToHex(value) : value;
}

function requireAccount(account: Account | undefined): Account {
    if (!account) {
        throw new Error(
            "INFTMinter write call requires an account — pass one to createINFTMinterClient.",
        );
    }
    return account;
}

/* ──────────── client interface ──────────── */

export interface INFTMinterClient {
    readonly address: Address;
    readonly chain: Chain;
    readonly publicClient: PublicClient;
    readonly walletClient: WalletClient | undefined;

    /* reads */
    getMintRecord(tokenId: bigint): Promise<MintRecord>;
    getSealedKey(tokenId: bigint, contributor: Address): Promise<Hex>;
    getTokenBySession(sessionId: bigint): Promise<bigint>;
    hasMinted(sessionId: bigint): Promise<boolean>;
    nextTokenId(): Promise<bigint>;
    minter(): Promise<Address>;

    /* writes (aggregator) */
    mint(args: {
        sessionId: bigint;
        modelBlobHash: Bytes;
        contributors: readonly Address[];
        sealedKeys: readonly Bytes[];
    }): Promise<Hash>;
}

/* ──────────── factory ──────────── */

export function createINFTMinterClient(
    options: INFTMinterClientOptions = {},
): INFTMinterClient {
    const chain = options.chain ?? galileo;
    const address = options.address ?? GALILEO_INFT_MINTER_ADDRESS;
    const transport = options.transport ?? http(options.rpcUrl);

    const publicClient: PublicClient = createPublicClient({chain, transport});
    const walletClient: WalletClient | undefined = options.account
        ? createWalletClient({chain, transport, account: options.account})
        : undefined;

    async function callRead<T>(label: string, fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (cause) {
            void label;
            rethrowINFTMinterError(cause);
        }
    }

    return {
        address,
        chain,
        publicClient,
        walletClient,

        getMintRecord: async (tokenId) => {
            const raw = await callRead("getMintRecord", () =>
                publicClient.readContract({
                    address,
                    abi: inftMinterAbi,
                    functionName: "getMintRecord",
                    args: [tokenId],
                }),
            );
            return {
                sessionId: raw.sessionId,
                modelBlobHash: raw.modelBlobHash,
                contributors: raw.contributors,
                mintedAt: raw.mintedAt,
            };
        },

        getSealedKey: (tokenId, contributor) =>
            callRead("getSealedKey", () =>
                publicClient.readContract({
                    address,
                    abi: inftMinterAbi,
                    functionName: "getSealedKey",
                    args: [tokenId, contributor],
                }),
            ),

        getTokenBySession: (sessionId) =>
            callRead("getTokenBySession", () =>
                publicClient.readContract({
                    address,
                    abi: inftMinterAbi,
                    functionName: "getTokenBySession",
                    args: [sessionId],
                }),
            ),

        hasMinted: (sessionId) =>
            callRead("hasMinted", () =>
                publicClient.readContract({
                    address,
                    abi: inftMinterAbi,
                    functionName: "hasMinted",
                    args: [sessionId],
                }),
            ),

        nextTokenId: () =>
            callRead("nextTokenId", () =>
                publicClient.readContract({
                    address,
                    abi: inftMinterAbi,
                    functionName: "nextTokenId",
                }),
            ),

        minter: () =>
            callRead("minter", () =>
                publicClient.readContract({
                    address,
                    abi: inftMinterAbi,
                    functionName: "minter",
                }),
            ),

        mint: async ({sessionId, modelBlobHash, contributors, sealedKeys}) => {
            const w = walletClient;
            const account = requireAccount(options.account);
            try {
                return await w!.writeContract({
                    chain,
                    account,
                    address,
                    abi: inftMinterAbi,
                    functionName: "mint",
                    args: [
                        sessionId,
                        asHex(modelBlobHash) as `0x${string}` & {length: 66},
                        contributors,
                        sealedKeys.map(asHex),
                    ],
                });
            } catch (cause) {
                rethrowINFTMinterError(cause);
            }
        },
    };
}
