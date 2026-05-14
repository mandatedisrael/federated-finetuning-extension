"use client";

import * as React from "react";
import { OG_CHAIN } from "./chain";

interface BalanceState {
  wei: bigint | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchBalance(address: string): Promise<bigint> {
  const res = await fetch(OG_CHAIN.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const data = (await res.json()) as { result?: string; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  if (!data.result) throw new Error("Empty response");
  return BigInt(data.result);
}

export function useOgBalance(address: string | undefined, pollMs = 20_000): BalanceState {
  const [wei, setWei] = React.useState<bigint | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!address) {
      setWei(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchBalance(address)
      .then((b) => {
        if (!cancelled) {
          setWei(b);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Balance error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick]);

  React.useEffect(() => {
    if (!address || pollMs <= 0) return;
    const id = window.setInterval(() => setTick((t) => t + 1), pollMs);
    return () => window.clearInterval(id);
  }, [address, pollMs]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  return { wei, loading, error, refresh };
}
