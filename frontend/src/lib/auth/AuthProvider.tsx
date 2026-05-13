"use client";

import * as React from "react";

/**
 * Mock auth provider. Designed to match the surface area of Privy /
 * Dynamic embedded wallets so the swap is one file later.
 *
 * Shape kept intentionally small:
 *   - signed-in user (email + display name + wallet address)
 *   - signInWithEmail(email)   → sends magic link (mocked: instant)
 *   - signInWithGoogle()       → OAuth (mocked: instant)
 *   - signOut()
 *
 * Persists to localStorage for now. No real crypto.
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  walletAddress: string;
  provider: "email" | "google";
}

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  signInWithEmail: (email: string) => Promise<AuthUser>;
  signInWithGoogle: () => Promise<AuthUser>;
  signOut: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "ffe:auth:user";

function fakeWallet(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).padStart(8, "0").repeat(5).slice(0, 40);
  return `0x${hex}`;
}

function userFromEmail(email: string): AuthUser {
  const local = email.split("@")[0] ?? "user";
  const display = local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: `u_${fakeWallet(email).slice(2, 10)}`,
    email,
    displayName: display,
    walletAddress: fakeWallet(email),
    provider: "email",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [status, setStatus] = React.useState<AuthContextValue["status"]>("loading");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser;
        setUser(parsed);
        setStatus("authenticated");
        return;
      }
    } catch {
      /* ignore */
    }
    setStatus("anonymous");
  }, []);

  const persist = React.useCallback((next: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
    setStatus("authenticated");
  }, []);

  const signInWithEmail = React.useCallback(
    async (email: string) => {
      await new Promise((r) => setTimeout(r, 350));
      const u = userFromEmail(email);
      persist(u);
      return u;
    },
    [persist],
  );

  const signInWithGoogle = React.useCallback(async () => {
    await new Promise((r) => setTimeout(r, 350));
    const u: AuthUser = {
      ...userFromEmail("you@gmail.com"),
      provider: "google",
      displayName: "You",
    };
    persist(u);
    return u;
  }, [persist]);

  const signOut = React.useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, status, signInWithEmail, signInWithGoogle, signOut }),
    [user, status, signInWithEmail, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
