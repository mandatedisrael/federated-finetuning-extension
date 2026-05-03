import {defineChain} from "viem";

/**
 * 0G Mainnet — chain config for viem.
 */
export const galileo = defineChain({
    id: 16661,
    name: "0G Mainnet",
    nativeCurrency: {
        name: "0G Token",
        symbol: "OG",
        decimals: 18,
    },
    rpcUrls: {
        default: {http: ["https://evmrpc.0g.ai"]},
    },
    blockExplorers: {
        default: {
            name: "0G Scan",
            url: "https://chainscan.0g.ai",
        },
    },
    testnet: false,
});

/** Address of the Coordinator deployed on 0G mainnet. */
export const GALILEO_COORDINATOR_ADDRESS = "0x840C3E83A5f3430079Aff7247CD957c994076015" as const;
