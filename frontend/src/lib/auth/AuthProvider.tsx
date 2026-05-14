"use client";

import * as React from "react";
import {
  PrivyProvider as PrivyProviderRaw,
  usePrivy,
  useLogout,
  type User as PrivyUser,
} from "@privy-io/react-auth";
import { OG_CHAIN } from "@/lib/og/chain";

const zeroGChain = {
  id: OG_CHAIN.id,
  name: OG_CHAIN.name,
  nativeCurrency: { name: OG_CHAIN.symbol, symbol: OG_CHAIN.symbol, decimals: OG_CHAIN.decimals },
  rpcUrls: {
    default: { http: [OG_CHAIN.rpcUrl] },
    public: { http: [OG_CHAIN.rpcUrl] },
  },
  blockExplorers: { default: { name: "ChainScan", url: OG_CHAIN.explorer } },
} as const;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  walletAddress: string;
  provider: "email" | "google" | "other";
}

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  signOut: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function pickProvider(u: PrivyUser): AuthUser["provider"] {
  if (u.google) return "google";
  if (u.email) return "email";
  return "other";
}

function pickEmail(u: PrivyUser): string {
  return u.email?.address ?? u.google?.email ?? "";
}

function pickDisplayName(u: PrivyUser, email: string): string {
  if (u.google?.name) return u.google.name;
  const local = email.split("@")[0] ?? "user";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickWallet(u: PrivyUser): string {
  return u.wallet?.address ?? "";
}

function adapt(u: PrivyUser): AuthUser {
  const email = pickEmail(u);
  return {
    id: u.id,
    email,
    displayName: pickDisplayName(u, email),
    walletAddress: pickWallet(u),
    provider: pickProvider(u),
  };
}

function AuthBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const { logout } = useLogout();

  const value = React.useMemo<AuthContextValue>(() => {
    const status: AuthContextValue["status"] = !ready
      ? "loading"
      : authenticated && privyUser
        ? "authenticated"
        : "anonymous";
    return {
      user: authenticated && privyUser ? adapt(privyUser) : null,
      status,
      signOut: () => {
        void logout();
      },
    };
  }, [ready, authenticated, privyUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    if (typeof window !== "undefined") {
      console.warn(
        "[auth] NEXT_PUBLIC_PRIVY_APP_ID is not set — sign-in will not work. Add it to .env.local.",
      );
    }
    const value: AuthContextValue = {
      user: null,
      status: "anonymous",
      signOut: () => {},
    };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  return (
    <PrivyProviderRaw
      appId={appId}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: { theme: "light", walletChainType: "ethereum-only" },
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        defaultChain: zeroGChain,
        supportedChains: [zeroGChain],
      }}
    >
      <AuthBridge>{children}</AuthBridge>
    </PrivyProviderRaw>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
