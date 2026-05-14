"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOgBalance } from "@/lib/og/useBalance";
import { OG_CHAIN, MIN_OG_FOR_FINETUNE_WEI, formatOg, shortAddress } from "@/lib/og/chain";

/**
 * Shown above fine-tune CTAs when the connected wallet has insufficient 0G.
 * Returns null when balance is sufficient or user not signed in.
 */
export function FundWalletBanner() {
  const { user, status } = useAuth();
  const { wei, loading } = useOgBalance(user?.walletAddress || undefined);
  const [copied, setCopied] = React.useState(false);

  if (status !== "authenticated" || !user?.walletAddress) return null;
  if (loading && wei === null) return null;
  if (wei === null || wei >= MIN_OG_FOR_FINETUNE_WEI) return null;

  async function copy() {
    if (!user?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border-status-warning/40 bg-status-warning/10 rounded-[var(--radius-md)] border p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert className="text-status-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-foreground text-sm font-medium">
              You need {OG_CHAIN.symbol} on {OG_CHAIN.name} chain to fine-tune.
            </p>
            <p className="text-foreground-muted text-xs">
              Your wallet currently holds {formatOg(wei)} {OG_CHAIN.symbol}. Send {OG_CHAIN.symbol}{" "}
              to the address below, then refresh.
            </p>
          </div>

          <div className="border-border bg-surface flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5">
            <code className="text-foreground truncate font-mono text-xs">
              {user.walletAddress}
            </code>
            <button
              type="button"
              onClick={copy}
              className="text-foreground-muted hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link
              href={OG_CHAIN.bridgeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent inline-flex items-center gap-1 hover:underline"
            >
              Bridge {OG_CHAIN.symbol} <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href={`${OG_CHAIN.explorer}/address/${user.walletAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-foreground-muted inline-flex items-center gap-1 hover:underline"
            >
              View {shortAddress(user.walletAddress)} on explorer{" "}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
