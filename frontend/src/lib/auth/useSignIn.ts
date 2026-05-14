"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@privy-io/react-auth";

/**
 * Opens Privy's hosted login modal. If a `redirectTo` is provided, the user
 * is navigated there once login completes.
 */
export function useSignIn() {
  const router = useRouter();
  const redirectRef = React.useRef<string | undefined>(undefined);

  const { login } = useLogin({
    onComplete: () => {
      const target = redirectRef.current;
      redirectRef.current = undefined;
      if (target) router.push(target);
    },
  });

  return React.useCallback(
    (redirectTo?: string) => {
      redirectRef.current = redirectTo;
      login();
    },
    [login],
  );
}
