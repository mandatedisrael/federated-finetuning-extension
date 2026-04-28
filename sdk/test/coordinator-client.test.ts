import {describe, expect, it} from "vitest";
import {
    BaseError,
    ContractFunctionRevertedError,
    custom,
    decodeFunctionData,
    encodeAbiParameters,
    encodeErrorResult,
    encodeFunctionResult,
    getAddress,
    keccak256,
    parseAbiParameters,
    type Address,
    type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {
    coordinatorAbi,
    CoordinatorError,
    createCoordinatorClient,
    galileo,
    GALILEO_COORDINATOR_ADDRESS,
    SessionStatus,
} from "../src/coordinator/index.js";
import {rethrowCoordinatorError} from "../src/coordinator/errors.js";

const ALICE: Address = getAddress("0x000000000000000000000000000000000000a11c");
const BOB: Address = getAddress("0x000000000000000000000000000000000000b0b0");
const CAROL: Address = getAddress("0x00000000000000000000000000000000000ca501");

const PK_A = ("0x" + "11".repeat(32)) as Hex;
const PK_B = ("0x" + "22".repeat(32)) as Hex;
const PK_C = ("0x" + "33".repeat(32)) as Hex;

const BASE_MODEL = keccak256(new TextEncoder().encode("Qwen2.5-0.5B"));
const BLOB_A = keccak256(new TextEncoder().encode("blob-A"));

/* ───── mock transport helpers ───── */

interface ReadHandlerMap {
    [functionName: string]: (args: readonly unknown[]) => unknown;
}

function makeReadTransport(handlers: ReadHandlerMap) {
    return custom({
        request: async ({method, params}) => {
            switch (method) {
                case "eth_chainId":
                    return `0x${galileo.id.toString(16)}`;
                case "eth_call": {
                    const [{data}] = params as [{data: Hex}];
                    const decoded = decodeFunctionData({abi: coordinatorAbi, data});
                    const handler = handlers[decoded.functionName];
                    if (!handler) {
                        throw new Error(`unhandled function: ${decoded.functionName}`);
                    }
                    const result = handler(decoded.args ?? []);
                    return encodeFunctionResult({
                        abi: coordinatorAbi,
                        functionName: decoded.functionName as never,
                        result: result as never,
                    });
                }
                default:
                    throw new Error(`unmocked method: ${method}`);
            }
        },
    });
}

/* ───── tests ───── */

describe("coordinator client — read path", () => {
    it("nextSessionId decodes the uint256", async () => {
        const client = createCoordinatorClient({
            transport: makeReadTransport({nextSessionId: () => 7n}),
        });
        await expect(client.nextSessionId()).resolves.toBe(7n);
    });

    it("getSession decodes the struct into a typed SessionInfo", async () => {
        const client = createCoordinatorClient({
            transport: makeReadTransport({
                getSession: () => ({
                    creator: ALICE,
                    baseModel: BASE_MODEL,
                    quorum: 3,
                    submittedCount: 1,
                    status: SessionStatus.Open,
                    aggregatorPubkey: PK_A,
                }),
            }),
        });
        const s = await client.getSession(1n);
        expect(s).toEqual({
            creator: ALICE,
            baseModel: BASE_MODEL,
            quorum: 3,
            submittedCount: 1,
            status: SessionStatus.Open,
            aggregatorPubkey: PK_A,
        });
    });

    it("getParticipants returns the address array", async () => {
        const client = createCoordinatorClient({
            transport: makeReadTransport({getParticipants: () => [ALICE, BOB, CAROL]}),
        });
        await expect(client.getParticipants(1n)).resolves.toEqual([ALICE, BOB, CAROL]);
    });

    it("getOwnerPubkey returns hex bytes", async () => {
        const client = createCoordinatorClient({
            transport: makeReadTransport({getOwnerPubkey: () => PK_B}),
        });
        await expect(client.getOwnerPubkey(1n, BOB)).resolves.toBe(PK_B);
    });

    it("isParticipant returns the bool", async () => {
        const client = createCoordinatorClient({
            transport: makeReadTransport({isParticipant: () => true}),
        });
        await expect(client.isParticipant(1n, ALICE)).resolves.toBe(true);
    });

});

describe("rethrowCoordinatorError", () => {
    it("decodes a viem ContractFunctionRevertedError into a typed CoordinatorError", () => {
        // Encode actual revert data for SessionNotFound() so viem's constructor
        // can decode the errorName from the ABI.
        const revertData = encodeErrorResult({
            abi: coordinatorAbi,
            errorName: "SessionNotFound",
        });
        const reverted = new ContractFunctionRevertedError({
            abi: coordinatorAbi,
            data: revertData,
            functionName: "getSession",
        });
        const wrapped = new BaseError("call failed", {cause: reverted});

        expect(() => rethrowCoordinatorError(wrapped)).toThrowError(CoordinatorError);
        try {
            rethrowCoordinatorError(wrapped);
        } catch (e) {
            expect(e).toBeInstanceOf(CoordinatorError);
            expect((e as CoordinatorError).contractCode).toBe("SessionNotFound");
        }
    });

    it("falls back to 'Unknown' when the cause is not a viem revert", () => {
        try {
            rethrowCoordinatorError(new Error("network blew up"));
        } catch (e) {
            expect(e).toBeInstanceOf(CoordinatorError);
            expect((e as CoordinatorError).contractCode).toBe("Unknown");
        }
    });
});

describe("coordinator client — construction", () => {
    it("defaults to Galileo address and chain", () => {
        const client = createCoordinatorClient({transport: makeReadTransport({})});
        expect(client.address).toBe(GALILEO_COORDINATOR_ADDRESS);
        expect(client.chain.id).toBe(galileo.id);
        expect(client.walletClient).toBeUndefined();
    });

    it("walletClient appears when an account is passed", () => {
        const account = privateKeyToAccount(("0x" + "ab".repeat(32)) as Hex);
        const client = createCoordinatorClient({
            transport: makeReadTransport({}),
            account,
        });
        expect(client.walletClient).toBeDefined();
    });

    it("write call without account throws a clear error", async () => {
        const client = createCoordinatorClient({transport: makeReadTransport({})});
        await expect(
            client.submit({sessionId: 1n, blobHash: BLOB_A}),
        ).rejects.toThrow(/requires an account/);
    });
});

describe("coordinator client — write path encoding", () => {
    it("createSession encodes args correctly (Uint8Array → hex)", async () => {
        const account = privateKeyToAccount(("0x" + "ab".repeat(32)) as Hex);

        // Capture the eth_estimateGas / eth_sendRawTransaction call data so we
        // can verify the SDK encoded the function selector + params correctly.
        let lastCallData: Hex | undefined;
        const transport = custom({
            request: async ({method, params}) => {
                switch (method) {
                    case "eth_chainId":
                        return `0x${galileo.id.toString(16)}`;
                    case "eth_getBlockByNumber":
                        return {baseFeePerGas: "0x1"};
                    case "eth_gasPrice":
                        return "0x1";
                    case "eth_maxPriorityFeePerGas":
                        return "0x1";
                    case "eth_getTransactionCount":
                        return "0x0";
                    case "eth_estimateGas":
                        lastCallData = (params as [{data: Hex}])[0].data;
                        return "0x100000";
                    case "eth_sendRawTransaction":
                        return "0xfeed".padEnd(66, "f") as Hex;
                    case "eth_call":
                        return "0x";
                    default:
                        throw new Error(`unmocked: ${method}`);
                }
            },
        });

        const client = createCoordinatorClient({transport, account});
        const ownerPubkeys = [
            new Uint8Array([0xaa, 0xbb]),
            new Uint8Array([0xcc, 0xdd]),
        ];

        // Send. We don't care about the tx hash; we care about the encoded data.
        await client.createSession({
            baseModel: BASE_MODEL,
            participants: [ALICE, BOB],
            ownerPubkeys,
            quorum: 2,
        });

        expect(lastCallData).toBeDefined();
        const decoded = decodeFunctionData({abi: coordinatorAbi, data: lastCallData!});
        expect(decoded.functionName).toBe("createSession");
        const args = decoded.args as readonly [Hex, readonly Address[], readonly Hex[], number];
        expect(args[0]).toBe(BASE_MODEL);
        expect(args[1]).toEqual([ALICE, BOB]);
        expect(args[2]).toEqual(["0xaabb", "0xccdd"]);
        expect(args[3]).toBe(2);
    });
});

/* tiny check that the encode helpers we use compile against the real ABI */
describe("type plumbing", () => {
    it("encode/decode round-trip for SessionCreated event topic", () => {
        // not a behavioural test — just confirms parseAbiParameters resolves
        // against tuple shapes used elsewhere in the SDK
        const topics = encodeAbiParameters(parseAbiParameters("uint256, address[]"), [1n, [ALICE]]);
        expect(topics.startsWith("0x")).toBe(true);
    });
});
