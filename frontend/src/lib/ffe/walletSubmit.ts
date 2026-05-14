import { encodeFunctionData, numberToHex, type Hex } from "viem";
import { OG_CHAIN } from "@/lib/og/chain";
import type { PrepareFfeContributionResult, SubmitFfeContributionResult } from "./types";

const coordinatorSubmitAbi = [
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sessionId", type: "uint256" },
      { name: "blobHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export async function switchProviderToOg(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: OG_CHAIN.hexId }],
    });
  } catch {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: OG_CHAIN.hexId,
          chainName: OG_CHAIN.name,
          nativeCurrency: {
            name: OG_CHAIN.symbol,
            symbol: OG_CHAIN.symbol,
            decimals: OG_CHAIN.decimals,
          },
          rpcUrls: [OG_CHAIN.rpcUrl],
          blockExplorerUrls: [OG_CHAIN.explorer],
        },
      ],
    });
  }
}

export async function submitPreparedContributionWithWallet({
  provider,
  from,
  prepared,
}: {
  provider: Eip1193Provider;
  from: string;
  prepared: PrepareFfeContributionResult;
}): Promise<SubmitFfeContributionResult> {
  await switchProviderToOg(provider);
  const data = encodeFunctionData({
    abi: coordinatorSubmitAbi,
    functionName: "submit",
    args: [BigInt(prepared.sessionId), prepared.rootHash as Hex],
  });
  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: prepared.coordinatorAddress,
        data,
        chainId: numberToHex(prepared.chainId),
      },
    ],
  })) as string;

  return {
    id: prepared.id,
    contributorId: prepared.contributorId,
    contributorName: prepared.contributorName,
    sessionId: prepared.sessionId,
    exampleCount: prepared.exampleCount,
    rootHash: prepared.rootHash,
    storageTxHash: prepared.storageTxHash,
    submitTxHash: txHash,
    submittedAt: new Date().toISOString(),
  };
}
