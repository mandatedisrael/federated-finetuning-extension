"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SignInDialog } from "@/components/auth/SignInDialog";

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
  const { status } = useAuth();
  const initialCode = params.get("code") ?? "";

  const [code, setCode] = React.useState(initialCode);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showSignIn, setShowSignIn] = React.useState(false);

  React.useEffect(() => {
    if (initialCode && status === "authenticated") {
      void redeem(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function redeem(rawCode: string) {
    const c = rawCode.trim();
    if (c.length < 4) {
      setError("That invite code looks too short.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Mock: pretend any valid-looking code maps to a sample project.
      await new Promise((r) => setTimeout(r, 400));
      const projectId = `p_${
        c
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 8)
          .toLowerCase() || "demo"
      }`;
      router.push(`/p/${projectId}`);
    } catch {
      setError("Could not redeem that invite. Double-check the code.");
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "authenticated") {
      setShowSignIn(true);
      return;
    }
    void redeem(code);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </Link>
        <TrustBadge />
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

      {showSignIn && (
        <SignInDialog
          open={showSignIn}
          onOpenChange={setShowSignIn}
          redirectTo={`/join?code=${encodeURIComponent(code)}`}
        />
      )}
    </main>
  );
}
