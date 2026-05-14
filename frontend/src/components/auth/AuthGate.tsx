"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignIn } from "@/lib/auth/useSignIn";

/**
 * Wraps any trigger (link/button) so that anonymous users see Privy's
 * sign-in modal instead of being routed to the destination.
 * Authed users get the normal click-through behavior.
 */
export function AuthGate({
  children,
  redirectTo,
}: {
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
  redirectTo?: string;
}) {
  const { status } = useAuth();
  const signIn = useSignIn();

  const trigger = React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      if (status !== "authenticated") {
        e.preventDefault();
        signIn(redirectTo);
      }
      children.props.onClick?.(e);
    },
  });

  return trigger;
}
