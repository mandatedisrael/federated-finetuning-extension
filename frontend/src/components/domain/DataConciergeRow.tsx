"use client";

import * as React from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Copy as CopyIcon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Data Concierge finding row. Each row represents one finding the
 * concierge surfaced while scanning the upload (PII, duplicates,
 * usable examples, etc.). Inline actions: Redact / Drop / Keep.
 */
export type FindingKind = "usable" | "duplicate" | "pii" | "format";

export type FindingAction = "redact" | "drop" | "keep";

interface DataConciergeRowProps {
  kind: FindingKind;
  count: number;
  description: string;
  actions?: FindingAction[];
  onAction?: (action: FindingAction) => void;
  className?: string;
}

const KIND_META: Record<FindingKind, { icon: React.ElementType; tint: string; bg: string }> = {
  usable: {
    icon: CheckCircle2,
    tint: "text-status-success",
    bg: "bg-[var(--status-success-bg)]",
  },
  duplicate: {
    icon: CopyIcon,
    tint: "text-foreground-muted",
    bg: "bg-surface-muted",
  },
  pii: {
    icon: ShieldAlert,
    tint: "text-status-warning",
    bg: "bg-[var(--status-warning-bg)]",
  },
  format: {
    icon: AlertTriangle,
    tint: "text-status-warning",
    bg: "bg-[var(--status-warning-bg)]",
  },
};

const ACTION_LABEL: Record<FindingAction, string> = {
  redact: "Redact",
  drop: "Drop",
  keep: "Keep",
};

export function DataConciergeRow({
  kind,
  count,
  description,
  actions,
  onAction,
  className,
}: DataConciergeRowProps) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "border-border bg-surface flex items-start gap-3 rounded-[var(--radius-md)] border p-3.5",
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
          meta.bg,
          meta.tint,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-foreground font-medium tracking-tight">{count}</span>
          <span className="text-foreground-muted text-sm">{description}</span>
        </div>
        {actions && actions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {actions.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === "keep" ? "ghost" : "secondary"}
                onClick={() => onAction?.(a)}
              >
                {ACTION_LABEL[a]}
              </Button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
