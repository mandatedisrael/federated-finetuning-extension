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
import {coordinatorAbi} from "./abi.js";
import {galileo} from "./chain.js";
import {rethrowCoordinatorError} from "./errors.js";

/* ──────────── public types ──────────── */

export type Bytes = Uint8Array | Hex;

export const enum SessionStatus {
    Open = 0,
    QuorumReached = 1,
}

export interface SessionInfo {
    creator: Address;
    baseModel: Hex;
    quorum: number;
    submittedCount: number;
    status: SessionStatus;
    aggregatorPubkey: Hex;
}

export interface CoordinatorClientOptions {
    /** Coordinator contract address. Defaults to the deployed Galileo address. */
    address?: Address;
    /** RPC URL. Defaults to the Galileo public endpoint. */
    rpcUrl?: string;
    /** Chain config. Defaults to Galileo. */
    chain?: Chain;
    /** Optional account for write operations. Reads work without one. */
    account?: Account;
    /** Override the underlying viem transport (mainly for testing). */
    transport?: Transport;
}

/* ──────────── helpers ──────────── */

function asHex(value: Bytes): Hex {
    return value instanceof Uint8Array ? bytesToHex(value) : value;
}

function requireAccount(account: Account | undefined): Account {
    if (!account) {
        throw new Error(
            "Coordinator write call requires an account — pass one to createCoordinatorClient.",
        );
    }
    return account;
}

/* ──────────── client ──────────── */

export interface CoordinatorClient {
    readonly address: Address;
    readonly chain: Chain;
    readonly publicClient: PublicClient;
    /** Undefined unless an `account` was provided at construction. */
    readonly walletClient: WalletClient | undefined;

    /* reads */
    nextSessionId(): Promise<bigint>;
    getSession(sessionId: bigint): Promise<SessionInfo>;
    getParticipants(sessionId: bigint): Promise<readonly Address[]>;
    getSubmitters(sessionId: bigint): Promise<readonly Address[]>;
    getSubmission(sessionId: bigint, contributor: Address): Promise<Hex>;
    getOwnerPubkey(sessionId: bigint, contributor: Address): Promise<Hex>;
    isParticipant(sessionId: bigint, account: Address): Promise<boolean>;

    /* writes */
    createSession(args: {
        baseModel: Bytes;
        participants: readonly Address[];
        ownerPubkeys: readonly Bytes[];
        quorum: number;
    }): Promise<Hash>;
    setAggregatorPubkey(args: {
        sessionId: bigint;
        pubkey: Bytes;
        attestation: Bytes;
    }): Promise<Hash>;
    submit(args: {sessionId: bigint; blobHash: Bytes}): Promise<Hash>;
}

export function createCoordinatorClient(options: CoordinatorClientOptions = {}): CoordinatorClient {
    const chain = options.chain ?? galileo;
    const address = options.address ?? ("0x4Dd446F51126d473070444041B9AA36d3ae7F295" as Address);

    const transport = options.transport ?? http(options.rpcUrl);

    const publicClient: PublicClient = createPublicClient({chain, transport});
    const walletClient: WalletClient | undefined = options.account
        ? createWalletClient({chain, transport, account: options.account})
        : undefined;

    /** Lift any viem error into a typed CoordinatorError. */
    async function callRead<T>(label: string, fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (cause) {
            // `label` retained for breadcrumbs; cause carries full viem trace
            void label;
            rethrowCoordinatorError(cause);
        }
    }

    return {
        address,
        chain,
        publicClient,
        walletClient,

        /* reads */

        nextSessionId: () =>
            callRead("nextSessionId", () =>
                publicClient.readContract({
                    address,
                    abi: coordinatorAbi,
                    functionName: "nextSessionId",
                }),
            ),

        getSession: async (sessionId) => {
            const raw = await callRead("getSession", () =>
                publicClient.readContract({
                    address,
                    abi: coordinatorAbi,
                    functionName: "getSession",
                    args: [sessionId],
                }),
            );
            return {
                creator: raw.creator,
                baseModel: raw.baseModel,
                quorum: raw.quorum,
                submittedCount: raw.submittedCount,
                status: raw.status as SessionStatus,
                aggregatorPubkey: raw.aggregatorPubkey,
            };
        },

        getParticipants: (sessionId) =>
            callRead("getParticipants", () =>
                publicClient.readContract({
                    address,
                    abi: coordinatorAbi,
                    functionName: "getParticipants",
                    args: [sessionId],
                }),
            ),

        getSubmitters: (sessionId) =>
            callRead("getSubmitters", () =>
                publicClient.readContract({
                    address,
                    abi: coordinatorAbi,
                    functionName: "getSubmitters",
                    args: [sessionId],
                }),
            ),

        getSubmission: (sessionId, contributor) =>
            callRead("getSubmission", () =>
                publicClient.readContract({
                    address,
                    abi: coordinatorAbi,
                    functionName: "getSubmission",
                    args: [sessionId, contributor],
                }),
            ),

        getOwnerPubkey: (sessionId, contributor) =>
            callRead("getOwnerPubkey", () =>
                publicClient.readContract({
                    address,
                    abi: coordinatorAbi,
                    functionName: "getOwnerPubkey",
                    args: [sessionId, contributor],
                }),
            ),

        isParticipant: (sessionId, account) =>
            callRead("isParticipant", () =>
                publicClient.readContract({
                    address,
                    abi: coordinatorAbi,
                    functionName: "isParticipant",
                    args: [sessionId, account],
                }),
            ),

        /* writes */

        createSession: async ({baseModel, participants, ownerPubkeys, quorum}) => {
            const w = walletClient;
            const account = requireAccount(options.account);
            try {
                return await w!.writeContract({
                    chain,
                    account,
                    address,
                    abi: coordinatorAbi,
                    functionName: "createSession",
                    args: [asHex(baseModel), participants, ownerPubkeys.map(asHex), quorum],
                });
            } catch (cause) {
                rethrowCoordinatorError(cause);
            }
        },

        setAggregatorPubkey: async ({sessionId, pubkey, attestation}) => {
            const w = walletClient;
            const account = requireAccount(options.account);
            try {
                return await w!.writeContract({
                    chain,
                    account,
                    address,
                    abi: coordinatorAbi,
                    functionName: "setAggregatorPubkey",
                    args: [sessionId, asHex(pubkey), asHex(attestation)],
                });
            } catch (cause) {
                rethrowCoordinatorError(cause);
            }
        },

        submit: async ({sessionId, blobHash}) => {
            const w = walletClient;
            const account = requireAccount(options.account);
            try {
                return await w!.writeContract({
                    chain,
                    account,
                    address,
                    abi: coordinatorAbi,
                    functionName: "submit",
                    args: [sessionId, asHex(blobHash)],
                });
            } catch (cause) {
                rethrowCoordinatorError(cause);
            }
        },
    };
}
