"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink, LogOut, Wallet, Loader2 } from "lucide-react";
import { useConnectWallet } from "@privy-io/react-auth";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOgBalance } from "@/lib/og/useBalance";
import { OG_CHAIN, MIN_OG_FOR_FINETUNE_WEI, formatOg, shortAddress } from "@/lib/og/chain";
import { useSignIn } from "@/lib/auth/useSignIn";
import { cn } from "@/lib/cn";

export function UserPill() {
  const { user, status, signOut } = useAuth();
  const { connectWallet } = useConnectWallet();
  const signIn = useSignIn();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const { wei, loading } = useOgBalance(user?.walletAddress || undefined);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (status === "loading") {
    return (
      <div className="border-border bg-surface text-foreground-muted h-9 w-28 animate-pulse rounded-[var(--radius-pill)] border" />
    );
  }

  if (status === "anonymous" || !user) {
    return (
      <Button size="sm" onClick={() => signIn()}>
        Sign in
      </Button>
    );
  }

  const lowBalance = wei !== null && wei < MIN_OG_FOR_FINETUNE_WEI;
  const balanceLabel =
    wei === null ? (loading ? "…" : "—") : `${formatOg(wei, 4)} ${OG_CHAIN.symbol}`;

  async function copyAddress() {
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border-border bg-surface hover:bg-surface-muted hover:border-border-strong",
          "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm",
          "transition-[background-color,border-color]",
        )}
      >
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            lowBalance ? "bg-status-warning" : "bg-status-success",
          )}
          aria-hidden
        />
        <span className="text-foreground font-medium tabular-nums">{balanceLabel}</span>
        <span className="text-foreground-subtle hidden sm:inline">·</span>
        <span className="text-foreground-muted hidden font-mono text-xs sm:inline">
          {shortAddress(user.walletAddress)}
        </span>
      </button>

      {open && (
        <div className="border-border bg-surface absolute right-0 z-40 mt-2 w-72 rounded-[var(--radius-lg)] border p-3 shadow-[var(--shadow-md)]">
          <div className="space-y-0.5 px-1 pb-2">
            <div className="text-foreground truncate text-sm font-medium">
              {user.displayName || user.email || "Account"}
            </div>
            {user.email && (
              <div className="text-foreground-muted truncate text-xs">{user.email}</div>
            )}
          </div>

          <div className="border-border bg-surface-muted rounded-[var(--radius-md)] border p-2.5">
            <div className="text-foreground-subtle text-[10px] tracking-widest uppercase">
              Wallet
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <code className="text-foreground truncate font-mono text-xs">
                {user.walletAddress || "—"}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="text-foreground-muted hover:text-foreground p-1"
                aria-label="Copy address"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-foreground-muted">Balance</span>
              <span className="text-foreground inline-flex items-center gap-1 tabular-nums">
                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                {balanceLabel}
              </span>
            </div>
            {lowBalance && (
              <div className="text-status-warning mt-2 text-[11px] leading-snug">
                Low balance. You&apos;ll need {OG_CHAIN.symbol} on {OG_CHAIN.name} chain to
                fine-tune.
              </div>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              href={OG_CHAIN.bridgeUrl}
              target="_blank"
              rel="noreferrer"
              className="border-border bg-surface hover:bg-surface-muted inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-1.5 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              Bridge {OG_CHAIN.symbol}
            </Link>
            <button
              type="button"
              onClick={() => connectWallet()}
              className="border-border bg-surface hover:bg-surface-muted inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-1.5 text-xs"
            >
              <Wallet className="h-3 w-3" />
              Link wallet
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-muted mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-xs"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
