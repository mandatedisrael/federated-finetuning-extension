"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SignInDialog } from "./SignInDialog";

/**
 * Wraps any trigger (link/button) so that anonymous users see the
 * sign-in dialog instead of being routed to the destination.
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
  const [open, setOpen] = React.useState(false);

  const trigger = React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      if (status !== "authenticated") {
        e.preventDefault();
        setOpen(true);
      }
      children.props.onClick?.(e);
    },
  });

  return (
    <>
      {trigger}
      <SignInDialog open={open} onOpenChange={setOpen} redirectTo={redirectTo} />
    </>
  );
}
