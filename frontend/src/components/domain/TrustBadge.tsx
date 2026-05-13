"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useAdvancedDrawer } from "@/lib/advanced/AdvancedDrawerProvider";

/**
 * Trust badge. The persistent privacy signal — visible on every screen
 * where a contributor's data is at rest or in motion.
 *
 *   variant="idle"        — calm green chip with lock
 *   variant="encrypting"  — soft pulse + active copy ("Encrypting…")
 *   variant="active"      — solid emphasis ("Encrypted, in transit")
 *
 * Clicking opens the Advanced Drawer (passed in by the parent).
 */
interface TrustBadgeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "idle" | "encrypting" | "active";
  label?: string;
}

export const TrustBadge = React.forwardRef<HTMLButtonElement, TrustBadgeProps>(
  ({ className, variant = "idle", label, onClick, ...props }, ref) => {
    const copy =
      label ??
      (variant === "encrypting"
        ? "Encrypting locally…"
        : variant === "active"
          ? "Encrypted, in transit"
          : "Your data is encrypted before upload");

    const pulsing = variant === "encrypting";
    const advanced = useAdvancedDrawer();

    function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
      onClick?.(e);
      if (e.defaultPrevented) return;
      advanced?.open();
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        className={cn(
          "group relative inline-flex items-center gap-2",
          "px-3 py-1.5 text-xs font-medium tracking-tight",
          "text-trust bg-[var(--trust-bg)]",
          "rounded-[var(--radius-pill)]",
          "transition-colors duration-150",
          "hover:bg-[var(--trust-bg)]/80",
          "focus-visible:ring-trust/40 focus-visible:ring-2 focus-visible:outline-none",
          className,
        )}
        {...props}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          {pulsing && (
            <motion.span
              className="absolute inset-0 rounded-full bg-[var(--trust-pulse)]"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
              aria-hidden
            />
          )}
          <Lock className="relative h-3.5 w-3.5" />
        </span>
        <span>{copy}</span>
        <span aria-hidden className="text-trust/60 group-hover:text-trust ml-0.5 text-[10px]">
          View details
        </span>
      </button>
    );
  },
);
TrustBadge.displayName = "TrustBadge";
