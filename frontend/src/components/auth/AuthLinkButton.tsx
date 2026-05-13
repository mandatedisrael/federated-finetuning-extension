"use client";

import * as React from "react";
import Link from "next/link";
import type { LinkProps } from "next/link";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SignInDialog } from "./SignInDialog";

interface AuthLinkButtonProps extends Omit<ButtonProps, "asChild" | "onClick"> {
  href: LinkProps["href"];
  redirectTo?: string;
}

export function AuthLinkButton({
  href,
  redirectTo,
  children,
  ...buttonProps
}: AuthLinkButtonProps) {
  const { status } = useAuth();
  const [open, setOpen] = React.useState(false);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (status === "authenticated") return;

    e.preventDefault();
    setOpen(true);
  }

  return (
    <>
      <Button {...buttonProps} asChild>
        <Link href={href} onClick={handleClick}>
          {children}
        </Link>
      </Button>
      {open && <SignInDialog open={open} onOpenChange={setOpen} redirectTo={redirectTo} />}
    </>
  );
}
