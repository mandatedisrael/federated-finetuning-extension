import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Fixed status palette per the designer brief:
 *   grey   — not started
 *   blue   — in progress
 *   green  — success
 *   amber  — needs attention
 *   red    — rejected (only after appeal window)
 */
export type ContributionStatus =
  | "not-started"
  | "uploaded"
  | "validated"
  | "included"
  | "needs-attention"
  | "rejected";

const STATUS_LABEL: Record<ContributionStatus, string> = {
  "not-started": "Not started",
  uploaded: "Uploaded",
  validated: "Validated",
  included: "Included",
  "needs-attention": "Needs attention",
  rejected: "Rejected",
};

const STATUS_TONE: Record<ContributionStatus, { bg: string; dot: string; text: string }> = {
  "not-started": {
    bg: "bg-[var(--status-idle-bg)]",
    dot: "bg-status-idle",
    text: "text-status-idle",
  },
  uploaded: {
    bg: "bg-[var(--status-progress-bg)]",
    dot: "bg-status-progress",
    text: "text-status-progress",
  },
  validated: {
    bg: "bg-[var(--status-progress-bg)]",
    dot: "bg-status-progress",
    text: "text-status-progress",
  },
  included: {
    bg: "bg-[var(--status-success-bg)]",
    dot: "bg-status-success",
    text: "text-status-success",
  },
  "needs-attention": {
    bg: "bg-[var(--status-warning-bg)]",
    dot: "bg-status-warning",
    text: "text-status-warning",
  },
  rejected: {
    bg: "bg-[var(--status-danger-bg)]",
    dot: "bg-status-danger",
    text: "text-status-danger",
  },
};

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ContributionStatus;
  pulse?: boolean;
}

export function StatusChip({ status, pulse, className, children, ...props }: StatusChipProps) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2 py-0.5 text-[11px] font-medium tracking-tight",
        "rounded-[var(--radius-pill)]",
        tone.bg,
        tone.text,
        className,
      )}
      {...props}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {pulse && (
          <span
            aria-hidden
            className={cn("absolute inset-0 animate-ping rounded-full opacity-60", tone.dot)}
          />
        )}
        <span className={cn("relative h-1.5 w-1.5 rounded-full", tone.dot)} />
      </span>
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}
