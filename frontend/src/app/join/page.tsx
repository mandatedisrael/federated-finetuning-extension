"use client";

import * as React from "react";
import { useConnectWallet, useWallets } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Link as LinkIcon, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { UserPill } from "@/components/auth/UserPill";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignIn } from "@/lib/auth/useSignIn";
import { createBrowserFfeKeyPair } from "@/lib/ffe/keys";
import { projectStore } from "@/lib/mock/projectStore";
import { loadProjectByInviteCode, registerProjectContributor } from "@/lib/projects/client";
import type { Project } from "@/lib/mock/types";

export default function JoinPage() {
  return (
    <React.Suspense fallback={null}>
      <JoinInner />
    </React.Suspense>
  );
}

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, status } = useAuth();
  const { ready: walletsReady, wallets } = useWallets();
  const { connectWallet } = useConnectWallet();
  const initialCode = params.get("code") ?? "";

  const [code, setCode] = React.useState(initialCode);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [project, setProject] = React.useState<Project | null>(null);
  const [registered, setRegistered] = React.useState(false);
  const signIn = useSignIn();

  React.useEffect(() => {
    if (initialCode && status === "authenticated" && walletsReady) {
      void redeem(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, walletsReady]);

  async function redeem(rawCode: string) {
    const c = rawCode.trim();
    if (c.length < 4) {
      setError("That invite code looks too short.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const matched =
        (await loadProjectByInviteCode(c).catch(() => null)) ?? projectStore.findByInviteCode(c);
      if (!matched) {
        throw new Error("Could not find a project with that invite code.");
      }
      setProject(matched);
      if (!user) {
        setBusy(false);
        return;
      }

      const wallet =
        wallets.find(
          (candidate) =>
            candidate.type === "ethereum" &&
            user.walletAddress &&
            candidate.address.toLowerCase() === user.walletAddress.toLowerCase(),
        ) ?? wallets.find((candidate) => candidate.type === "ethereum");
      if (!wallet) {
        setError("Connect a wallet so this project can register your training key.");
        setBusy(false);
        return;
      }

      const target =
        matched.contributors.find((contributor) => contributor.id === user.id) ??
        matched.contributors.find(
          (contributor) =>
            user.email && contributor.email.toLowerCase() === user.email.toLowerCase(),
        ) ??
        matched.contributors.find(
          (contributor) =>
            contributor.walletAddress &&
            contributor.walletAddress.toLowerCase() === wallet.address.toLowerCase(),
        ) ??
        matched.contributors.find(
          (contributor) => contributor.role !== "owner" && !contributor.registeredAt,
        );

      if (!target) {
        throw new Error("This project already has all invite seats registered.");
      }

      const keys = createBrowserFfeKeyPair();
      const persisted = await registerProjectContributor({
        projectId: matched.id,
        inviteCode: matched.inviteCode,
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        walletAddress: wallet.address,
        ffePublicKey: keys.publicKey,
        ffePrivateKey: keys.privateKey,
      }).catch(() => null);
      const contributors = matched.contributors.map((contributor) =>
        contributor.id === target.id
          ? {
              ...contributor,
              id: user.id,
              name: user.displayName || contributor.name,
              email: user.email || contributor.email,
              walletAddress: wallet.address,
              ffePublicKey: keys.publicKey,
              ffePrivateKey: keys.privateKey,
              registeredAt: new Date().toISOString(),
            }
          : contributor,
      );
      const updated = persisted ?? projectStore.update(matched.id, { contributors });
      if (updated) setProject(updated);
      setRegistered(true);
      window.setTimeout(() => router.push(`/p/${matched.id}`), 700);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not redeem that invite. Double-check the code.",
      );
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "authenticated") {
      signIn(`/join?code=${encodeURIComponent(code)}`);
      return;
    }
    void redeem(code);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <TrustBadge />
          <UserPill />
        </div>{" "}
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
            Join a project
          </p>
          <h1 className="font-serif text-4xl tracking-tight">Got an invite?</h1>
          <p className="text-foreground-muted mt-3 text-base leading-relaxed">
            Paste the invite link or code your project owner shared with you.
          </p>

          <form className="mt-8 space-y-3" onSubmit={onSubmit}>
            <Label htmlFor="invite-code">Invite link or code</Label>
            <div className="flex gap-2">
              <Input
                id="invite-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ffe.app/join?code=…  or  ABC123"
                disabled={busy}
              />
              <Button type="submit" disabled={busy || code.trim().length === 0}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                Join
              </Button>
            </div>
            {error && <p className="text-status-danger text-xs">{error}</p>}
          </form>

          {status === "authenticated" && project && error?.includes("Connect a wallet") && (
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => connectWallet()}
            >
              <Wallet className="h-4 w-4" />
              Connect wallet
            </Button>
          )}

          {registered && project && (
            <div className="border-trust/20 text-trust mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border bg-[var(--trust-bg)] p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Registered for {project.name}. Opening the project now.</p>
            </div>
          )}

          <div className="border-border bg-surface mt-10 rounded-[var(--radius-lg)] border p-4">
            <p className="text-foreground-muted text-xs leading-relaxed">
              You only need a code if you were invited. Want to start your own?{" "}
              <Link className="text-accent underline-offset-4 hover:underline" href="/new">
                Create a project
              </Link>
              .
            </p>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
