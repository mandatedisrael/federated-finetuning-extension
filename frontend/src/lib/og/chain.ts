export const OG_CHAIN = {
  id: 16661,
  hexId: "0x4115",
  name: "0G",
  rpcUrl: "https://evmrpc.0g.ai",
  explorer: "https://chainscan.0g.ai",
  symbol: "0G",
  decimals: 18,
  bridgeUrl: "https://hub.0g.ai/bridge",
} as const;

export const MIN_OG_FOR_FINETUNE_WEI = 10_000_000_000_000_000n;

export function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatOg(wei: bigint, maxFractionDigits = 4): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return `${whole}`;
  const fracStr = frac.toString().padStart(18, "0").slice(0, maxFractionDigits);
  const trimmed = fracStr.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : `${whole}`;
}
