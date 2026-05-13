import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badge = cva(
  [
    "inline-flex items-center gap-1.5",
    "text-xs font-medium tracking-tight",
    "rounded-[var(--radius-pill)] px-2.5 py-0.5",
    "transition-colors",
  ],
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-foreground-muted",
        accent: "bg-accent-soft text-accent",
        success: "bg-[var(--status-success-bg)] text-status-success",
        warning: "bg-[var(--status-warning-bg)] text-status-warning",
        danger: "bg-[var(--status-danger-bg)] text-status-danger",
        info: "bg-[var(--status-progress-bg)] text-status-progress",
        trust: "bg-[var(--trust-bg)] text-trust",
      },
      outline: {
        true: "bg-transparent ring-1 ring-inset",
        false: "",
      },
    },
    compoundVariants: [
      { outline: true, tone: "neutral", class: "ring-border text-foreground-muted" },
      { outline: true, tone: "accent", class: "ring-accent/30 text-accent" },
    ],
    defaultVariants: {
      tone: "neutral",
      outline: false,
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, outline, ...props }, ref) => (
    <span ref={ref} className={cn(badge({ tone, outline, className }))} {...props} />
  ),
);
Badge.displayName = "Badge";
