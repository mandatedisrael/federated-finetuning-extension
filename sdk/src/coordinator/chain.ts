import {defineChain} from "viem";

/**
 * 0G Galileo testnet — chain config for viem.
 *
 * RPC and explorer endpoints are the public ones from docs.0g.ai. For
 * production-grade workloads, swap the RPC URL for a private provider
 * (Ankr, dRPC, QuickNode, ThirdWeb, etc.).
 */
export const galileo = defineChain({
    id: 16602,
    name: "0G Galileo Testnet",
    nativeCurrency: {
        name: "0G Test Token",
        symbol: "OG",
        decimals: 18,
    },
    rpcUrls: {
        default: {http: ["https://evmrpc-testnet.0g.ai"]},
    },
    blockExplorers: {
        default: {
            name: "Galileo Chainscan",
            url: "https://chainscan-galileo.0g.ai",
        },
    },
    testnet: true,
});

/** Address of the Coordinator deployed on Galileo. */
export const GALILEO_COORDINATOR_ADDRESS = "0x4Dd446F51126d473070444041B9AA36d3ae7F295" as const;
