import * as React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Plain-English metric card. No loss curves, no epoch counters —
 * just one sentence of outcome plus an optional trend.
 *
 *   "Won 78% of comparisons against the previous version."
 *   "Regressed on cancellation questions — needs review."
 */
export type Trend = "up" | "down" | "flat";

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  description: string;
  trend?: Trend;
  trendLabel?: string;
}

const TREND_META: Record<Trend, { icon: React.ElementType; tone: string }> = {
  up: { icon: ArrowUpRight, tone: "text-status-success bg-[var(--status-success-bg)]" },
  down: { icon: ArrowDownRight, tone: "text-status-danger bg-[var(--status-danger-bg)]" },
  flat: { icon: Minus, tone: "text-foreground-muted bg-surface-muted" },
};

export function MetricCard({
  value,
  description,
  trend,
  trendLabel,
  className,
  ...props
}: MetricCardProps) {
  const meta = trend ? TREND_META[trend] : null;
  const TrendIcon = meta?.icon;

  return (
    <div
      className={cn(
        "border-border bg-surface flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5",
        "shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-serif text-3xl leading-none tracking-tight">{value}</span>
        {meta && TrendIcon && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium",
              "rounded-[var(--radius-pill)]",
              meta.tone,
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trendLabel ?? ""}
          </span>
        )}
      </div>
      <p className="text-foreground-muted text-sm leading-snug">{description}</p>
    </div>
  );
}
