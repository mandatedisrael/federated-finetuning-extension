import {describe, expect, it} from "vitest";
import {
    BaseError,
    ContractFunctionRevertedError,
    custom,
    decodeFunctionData,
    encodeErrorResult,
    encodeFunctionResult,
    getAddress,
    keccak256,
    type Address,
    type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {galileo} from "../src/coordinator/chain.js";
import {
    createINFTMinterClient,
    GALILEO_INFT_MINTER_ADDRESS,
} from "../src/inft/client.js";
import {inftMinterAbi} from "../src/inft/abi.js";
import {INFTMinterError, rethrowINFTMinterError} from "../src/inft/errors.js";

const ALICE: Address = getAddress("0x000000000000000000000000000000000000a11c");
const BOB: Address = getAddress("0x000000000000000000000000000000000000b0b0");
const SK_A: Hex = "0xaabbccdd";
const SK_B: Hex = "0xeeff0011";
const MODEL_HASH = keccak256(new TextEncoder().encode("lora-v1")) as Hex;

/* ───── mock transport ───── */

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
                    const decoded = decodeFunctionData({abi: inftMinterAbi, data});
                    const handler = handlers[decoded.functionName];
                    if (!handler) throw new Error(`unhandled: ${decoded.functionName}`);
                    const result = handler(decoded.args ?? []);
                    return encodeFunctionResult({
                        abi: inftMinterAbi,
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

/* ───── read path ───── */

describe("INFTMinter client — read path", () => {
    it("nextTokenId decodes the uint256", async () => {
        const client = createINFTMinterClient({
            transport: makeReadTransport({nextTokenId: () => 5n}),
        });
        await expect(client.nextTokenId()).resolves.toBe(5n);
    });

    it("hasMinted returns the bool", async () => {
        const client = createINFTMinterClient({
            transport: makeReadTransport({hasMinted: () => true}),
        });
        await expect(client.hasMinted(1n)).resolves.toBe(true);
    });

    it("getTokenBySession returns the tokenId", async () => {
        const client = createINFTMinterClient({
            transport: makeReadTransport({getTokenBySession: () => 3n}),
        });
        await expect(client.getTokenBySession(1n)).resolves.toBe(3n);
    });

    it("getSealedKey returns hex bytes", async () => {
        const client = createINFTMinterClient({
            transport: makeReadTransport({getSealedKey: () => SK_A}),
        });
        await expect(client.getSealedKey(1n, ALICE)).resolves.toBe(SK_A);
    });

    it("getMintRecord decodes the struct", async () => {
        const client = createINFTMinterClient({
            transport: makeReadTransport({
                getMintRecord: () => ({
                    sessionId: 2n,
                    modelBlobHash: MODEL_HASH,
                    contributors: [ALICE, BOB],
                    mintedAt: 1_700_000_000n,
                }),
            }),
        });
        const rec = await client.getMintRecord(1n);
        expect(rec.sessionId).toBe(2n);
        expect(rec.modelBlobHash).toBe(MODEL_HASH);
        expect(rec.contributors).toEqual([ALICE, BOB]);
        expect(rec.mintedAt).toBe(1_700_000_000n);
    });

    it("minter returns the address", async () => {
        const client = createINFTMinterClient({
            transport: makeReadTransport({minter: () => ALICE}),
        });
        await expect(client.minter()).resolves.toBe(ALICE);
    });
});

/* ───── construction ───── */

describe("INFTMinter client — construction", () => {
    it("defaults to Galileo address and chain", () => {
        const client = createINFTMinterClient({transport: makeReadTransport({})});
        expect(client.address).toBe(GALILEO_INFT_MINTER_ADDRESS);
        expect(client.chain.id).toBe(galileo.id);
        expect(client.walletClient).toBeUndefined();
    });

    it("walletClient appears when an account is passed", () => {
        const account = privateKeyToAccount(("0x" + "ab".repeat(32)) as Hex);
        const client = createINFTMinterClient({
            transport: makeReadTransport({}),
            account,
        });
        expect(client.walletClient).toBeDefined();
    });

    it("write call without account throws a clear error", async () => {
        const client = createINFTMinterClient({transport: makeReadTransport({})});
        await expect(
            client.mint({
                sessionId: 1n,
                modelBlobHash: MODEL_HASH,
                contributors: [ALICE],
                sealedKeys: [SK_A],
            }),
        ).rejects.toThrow(/requires an account/);
    });
});

/* ───── error decoding ───── */

describe("rethrowINFTMinterError", () => {
    it("decodes a viem ContractFunctionRevertedError into a typed INFTMinterError", () => {
        const revertData = encodeErrorResult({
            abi: inftMinterAbi,
            errorName: "SessionNotMinted",
        });
        const reverted = new ContractFunctionRevertedError({
            abi: inftMinterAbi,
            data: revertData,
            functionName: "getTokenBySession",
        });
        const wrapped = new BaseError("call failed", {cause: reverted});

        try {
            rethrowINFTMinterError(wrapped);
        } catch (e) {
            expect(e).toBeInstanceOf(INFTMinterError);
            expect((e as INFTMinterError).contractCode).toBe("SessionNotMinted");
        }
    });

    it("falls back to Unknown for non-revert errors", () => {
        try {
            rethrowINFTMinterError(new Error("rpc timeout"));
        } catch (e) {
            expect(e).toBeInstanceOf(INFTMinterError);
            expect((e as INFTMinterError).contractCode).toBe("Unknown");
        }
    });
});

/* ───── write path encoding ───── */

describe("INFTMinter client — write path encoding", () => {
    it("mint encodes Uint8Array sealedKeys → hex", async () => {
        const account = privateKeyToAccount(("0x" + "ab".repeat(32)) as Hex);

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

        const client = createINFTMinterClient({transport, account});
        const rawKeyA = new Uint8Array([0xaa, 0xbb]);
        const rawKeyB = new Uint8Array([0xcc, 0xdd]);

        await client.mint({
            sessionId: 1n,
            modelBlobHash: MODEL_HASH,
            contributors: [ALICE, BOB],
            sealedKeys: [rawKeyA, rawKeyB],
        });

        expect(lastCallData).toBeDefined();
        const decoded = decodeFunctionData({abi: inftMinterAbi, data: lastCallData!});
        expect(decoded.functionName).toBe("mint");
        const args = decoded.args as [bigint, Hex, Address[], Hex[]];
        expect(args[0]).toBe(1n);
        expect(args[1]).toBe(MODEL_HASH);
        expect(args[2]).toEqual([ALICE, BOB]);
        expect(args[3]).toEqual(["0xaabb", "0xccdd"]);
    });
});
