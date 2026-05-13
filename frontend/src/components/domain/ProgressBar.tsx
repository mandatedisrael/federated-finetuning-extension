"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export const PROJECT_STAGES = ["waiting", "checking", "training", "ready"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

const STAGE_LABEL: Record<ProjectStage, string> = {
  waiting: "Waiting for contributors",
  checking: "Checking data quality",
  training: "Training",
  ready: "Ready",
};

interface ProgressBarProps {
  stage: ProjectStage;
  className?: string;
}

/**
 * Four-stage progress bar. The liquid fill animates between
 * stages on prop change; the active stage label glows softly.
 *
 *   waiting → checking → training → ready
 */
export function ProgressBar({ stage, className }: ProgressBarProps) {
  const stageIndex = PROJECT_STAGES.indexOf(stage);
  const fillPercent = ((stageIndex + 1) / PROJECT_STAGES.length) * 100;

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-surface-muted relative h-2.5 w-full overflow-hidden rounded-[var(--radius-pill)]">
        <motion.div
          className="from-accent/80 to-accent absolute inset-y-0 left-0 rounded-[var(--radius-pill)] bg-gradient-to-r"
          initial={false}
          animate={{ width: `${fillPercent}%` }}
          transition={{
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
        {/* shimmer for the active stage while in progress */}
        {stage !== "ready" && (
          <motion.div
            className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            initial={{ left: "-25%" }}
            animate={{ left: "110%" }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ width: `${100 / PROJECT_STAGES.length}%` }}
          />
        )}
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
        {PROJECT_STAGES.map((s, i) => {
          const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium",
                  state === "done" && "bg-accent text-accent-foreground",
                  state === "active" && "ring-accent/30 bg-accent-soft text-accent ring-2",
                  state === "pending" && "bg-surface-muted text-foreground-subtle",
                )}
              >
                {state === "done" ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "tracking-tight",
                  state === "active" && "text-foreground font-medium",
                  state === "done" && "text-foreground-muted",
                  state === "pending" && "text-foreground-subtle",
                )}
              >
                {STAGE_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
