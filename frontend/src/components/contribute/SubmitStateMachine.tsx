"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, UploadCloud, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type SubmitPhase = "idle" | "encrypting" | "uploading" | "submitted";

const STEPS: Array<{
  phase: SubmitPhase;
  label: string;
  icon: React.ElementType;
}> = [
  { phase: "encrypting", label: "Encrypting locally", icon: Lock },
  { phase: "uploading", label: "Uploading", icon: UploadCloud },
  { phase: "submitted", label: "Submitted", icon: Check },
];

interface Props {
  phase: SubmitPhase;
  className?: string;
}

export function SubmitStateMachine({ phase, className }: Props) {
  if (phase === "idle") return null;

  const order = STEPS.map((s) => s.phase);
  const currentIdx = order.indexOf(phase);

  return (
    <AnimatePresence>
      <motion.div
        key="state-machine"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "border-border bg-surface flex items-center gap-3 rounded-[var(--radius-pill)] border p-1.5 pl-3",
          "shadow-[var(--shadow-md)]",
          className,
        )}
      >
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
          const isFinal = phase === "submitted" && state === "done";
          return (
            <React.Fragment key={step.phase}>
              <motion.div
                layout
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1 text-xs font-medium tracking-tight",
                  "rounded-[var(--radius-pill)] transition-colors duration-200",
                  state === "done" && "bg-trust/15 text-trust",
                  state === "active" &&
                    (phase === "submitted"
                      ? "bg-trust text-white"
                      : "bg-accent text-accent-foreground"),
                  state === "pending" && "text-foreground-subtle",
                )}
              >
                {state === "active" && phase !== "submitted" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isFinal ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span>{step.label}</span>
              </motion.div>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px w-4 transition-colors",
                    i < currentIdx ? "bg-trust/40" : "bg-border",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
