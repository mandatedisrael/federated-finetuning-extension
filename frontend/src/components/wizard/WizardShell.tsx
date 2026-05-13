"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { cn } from "@/lib/cn";

export interface WizardStep {
  id: string;
  label: string;
  /** Returns true if the step is valid and the user may proceed. */
  isValid: () => boolean;
  render: () => React.ReactNode;
}

interface WizardShellProps {
  steps: WizardStep[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onCancel: () => void;
  finishLabel?: string;
  busy?: boolean;
}

export function WizardShell({
  steps,
  currentIndex,
  onPrev,
  onNext,
  onCancel,
  finishLabel = "Create project",
  busy,
}: WizardShellProps) {
  const step = steps[currentIndex];
  if (!step) return null;
  const isLast = currentIndex === steps.length - 1;
  const canProceed = step.isValid();

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </Link>
        <TrustBadge />
      </header>

      {/* progress strip */}
      <div className="mx-auto mt-8 w-full max-w-2xl px-6">
        <ol className="flex items-center gap-2">
          {steps.map((s, i) => {
            const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
            return (
              <li key={s.id} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                    state === "done" && "bg-accent text-accent-foreground",
                    state === "active" && "ring-accent/40 bg-accent-soft text-accent ring-2",
                    state === "pending" && "bg-surface-muted text-foreground-subtle",
                  )}
                >
                  {state === "done" ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-xs tracking-tight sm:inline",
                    state === "active" && "text-foreground font-medium",
                    state === "done" && "text-foreground-muted",
                    state === "pending" && "text-foreground-subtle",
                  )}
                >
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <span
                    className={cn(
                      "h-px flex-1 transition-colors",
                      state === "done" ? "bg-accent/60" : "bg-border",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1"
          >
            {step.render()}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between">
          {currentIndex === 0 ? (
            <Button variant="ghost" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" onClick={onPrev}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <Button onClick={onNext} disabled={!canProceed || busy}>
            {isLast ? finishLabel : "Continue"}
            {!isLast && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </section>
    </main>
  );
}
