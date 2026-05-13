"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AdvancedDrawer } from "@/components/domain/AdvancedDrawer";
import { useAuth } from "@/lib/auth/AuthProvider";

interface AdvancedDrawerContextValue {
  open: () => void;
  close: () => void;
}

const AdvancedDrawerContext =
  React.createContext<AdvancedDrawerContextValue | null>(null);

function projectIdFromPath(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const match = pathname.match(/^\/p\/([^/]+)/);
  return match?.[1];
}

export function AdvancedDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const projectId = projectIdFromPath(pathname);

  const value = React.useMemo<AdvancedDrawerContextValue>(
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [],
  );

  return (
    <AdvancedDrawerContext.Provider value={value}>
      {children}
      <AdvancedDrawer
        open={isOpen}
        onOpenChange={setIsOpen}
        projectId={projectId}
        userId={user?.id}
      />
    </AdvancedDrawerContext.Provider>
  );
}

export function useAdvancedDrawer() {
  return React.useContext(AdvancedDrawerContext);
}
