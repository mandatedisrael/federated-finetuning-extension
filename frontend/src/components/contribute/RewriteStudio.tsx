"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, SkipForward, Flag, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { SubmitStateMachine, type SubmitPhase } from "./SubmitStateMachine";
import { REWRITE_PROMPTS } from "@/lib/mock/rewritePrompts";
import { projectStore } from "@/lib/mock/projectStore";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";

const TARGET = 50;

interface RewriteEntry {
  promptId: string;
  ideal: string;
  flagged?: boolean;
}

export function RewriteStudio({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [entries, setEntries] = React.useState<RewriteEntry[]>([]);
  const [submit, setSubmit] = React.useState<SubmitPhase>("idle");
  const [done, setDone] = React.useState(false);

  const saved = entries.filter((e) => !e.flagged && e.ideal.trim().length >= 6);
  const progress = Math.min(1, saved.length / TARGET);

  function upsert(promptId: string, patch: Partial<RewriteEntry>) {
    setEntries((prev) => {
      const existing = prev.find((e) => e.promptId === promptId);
      if (existing) {
        return prev.map((e) => (e.promptId === promptId ? { ...e, ...patch } : e));
      }
      return [...prev, { promptId, ideal: "", ...patch }];
    });
  }

  async function handleSubmitAll() {
    if (saved.length === 0) return;
    setSubmit("encrypting");
    await new Promise((r) => setTimeout(r, 1100));
    setSubmit("uploading");
    await new Promise((r) => setTimeout(r, 1100));
    setSubmit("submitted");

    if (user) {
      const p = projectStore.get(projectId);
      if (p) {
        const updated = p.contributors.map((c) =>
          c.id === user.id ? { ...c, status: "uploaded" as const, exampleCount: saved.length } : c,
        );
        projectStore.update(projectId, { contributors: updated });
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    setDone(true);
  }

  if (done) {
    return (
      <div className="border-border bg-surface flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border p-10 text-center">
        <SubmitStateMachine phase="submitted" />
        <div>
          <h3 className="font-serif text-3xl tracking-tight">{saved.length} examples submitted.</h3>
          <p className="text-foreground-muted mt-1 max-w-md text-sm leading-relaxed">
            Your rewrites are encrypted and queued for training. You&apos;ll see them reflected in
            the next version comparison.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="border-border bg-surface flex items-center justify-between gap-3 rounded-[var(--radius-md)] border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm">
            <span className="font-medium tabular-nums">{saved.length}</span>{" "}
            <span className="text-foreground-muted">of recommended {TARGET} examples</span>
          </p>
          <div className="bg-surface-muted relative mt-1.5 h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)]">
            <motion.div
              className="bg-accent absolute inset-y-0 left-0"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
        <Sparkles className="text-foreground-subtle h-4 w-4" />
      </header>

      <AnimatePresence>
        {submit !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex justify-center"
          >
            <SubmitStateMachine phase={submit} />
          </motion.div>
        )}
      </AnimatePresence>

      <ol className="space-y-3">
        {REWRITE_PROMPTS.map((p, i) => {
          const entry = entries.find((e) => e.promptId === p.id);
          return (
            <RewriteCard
              key={p.id}
              index={i}
              prompt={p}
              entry={entry}
              onChange={(ideal) => upsert(p.id, { ideal, flagged: false })}
              onFlag={() => upsert(p.id, { flagged: true })}
              onSkip={() => upsert(p.id, { ideal: "" })}
              disabled={submit !== "idle"}
            />
          );
        })}
      </ol>

      <div className="border-border bg-surface sticky bottom-4 z-10 flex flex-col items-center justify-between gap-3 rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-md)] sm:flex-row">
        <p className="text-foreground-muted text-xs leading-relaxed">
          {saved.length === 0
            ? "Save at least one rewrite to submit."
            : `Submitting ${saved.length} ${saved.length === 1 ? "rewrite" : "rewrites"} — encrypted in your browser first.`}
        </p>
        <Button
          onClick={handleSubmitAll}
          disabled={saved.length === 0 || submit !== "idle"}
          size="lg"
        >
          <Lock className="h-4 w-4" />
          Encrypt and submit all
        </Button>
      </div>
    </div>
  );
}

function RewriteCard({
  index,
  prompt,
  entry,
  onChange,
  onFlag,
  onSkip,
  disabled,
}: {
  index: number;
  prompt: (typeof REWRITE_PROMPTS)[number];
  entry?: RewriteEntry;
  onChange: (v: string) => void;
  onFlag: () => void;
  onSkip: () => void;
  disabled?: boolean;
}) {
  const ideal = entry?.ideal ?? "";
  const flagged = entry?.flagged;
  const saved = ideal.trim().length >= 6 && !flagged;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28 }}
      className={cn(
        "border-border bg-surface space-y-3 rounded-[var(--radius-lg)] border p-4",
        saved && "border-trust/40 bg-trust/5",
        flagged && "border-status-warning/40 opacity-70",
      )}
    >
      <div>
        <p className="text-foreground-subtle text-[10px] tracking-widest uppercase">User asked</p>
        <p className="text-foreground mt-1 text-sm leading-relaxed">{prompt.userMessage}</p>
      </div>
      <div>
        <p className="text-foreground-subtle text-[10px] tracking-widest uppercase">
          Current assistant reply
        </p>
        <p className="text-foreground-muted mt-1 text-sm leading-relaxed italic">
          {prompt.currentReply}
        </p>
      </div>
      <div>
        <p className="text-foreground-subtle text-[10px] tracking-widest uppercase">Ideal answer</p>
        <Textarea
          rows={3}
          className="mt-1.5"
          placeholder="Rewrite the reply the way it should have been answered…"
          value={ideal}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onFlag} disabled={disabled}>
          <Flag className="h-3.5 w-3.5" />
          Flag as unsafe
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={disabled}>
          <SkipForward className="h-3.5 w-3.5" />
          Skip
        </Button>
        <Button
          size="sm"
          variant={saved ? "secondary" : "primary"}
          disabled={disabled || ideal.trim().length < 6}
          onClick={() => onChange(ideal)}
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </motion.li>
  );
}
