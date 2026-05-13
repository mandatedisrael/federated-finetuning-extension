"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Mail, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Separator } from "@/components/ui/Separator";
import { useAuth } from "@/lib/auth/AuthProvider";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function SignInDialog({ open, onOpenChange, redirectTo }: SignInDialogProps) {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState<"email" | "google" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Use a valid email.");
      return;
    }
    setError(null);
    setBusy("email");
    try {
      await signInWithEmail(email);
      onOpenChange(false);
      if (redirectTo) router.push(redirectTo);
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle();
      onOpenChange(false);
      if (redirectTo) router.push(redirectTo);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            Email or Google. We&apos;ll create your wallet quietly in the background — no setup
            needed.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center"
            disabled={busy !== null}
            onClick={handleGoogle}
          >
            {busy === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-foreground-subtle text-xs tracking-widest uppercase">or</span>
            <Separator className="flex-1" />
          </div>

          <form className="space-y-3" onSubmit={handleEmail}>
            <div className="space-y-1.5">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy !== null}
              />
            </div>
            {error && <p className="text-status-danger text-xs">{error}</p>}
            <Button type="submit" className="w-full justify-center" disabled={busy !== null}>
              {busy === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Continue with email
            </Button>
          </form>
        </motion.div>

        <p className="text-foreground-subtle mt-2 text-xs leading-relaxed">
          By continuing you agree to the privacy guarantees: your data is encrypted in your browser
          before it goes anywhere.
        </p>
      </DialogContent>
    </Dialog>
  );
}
