"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, ShieldCheck } from "lucide-react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject } from "@/lib/mock/seedDemo";
import type { Project, MustPassScenario } from "@/lib/mock/types";

function shortId() {
  return `mp_${Math.random().toString(36).slice(2, 8)}`;
}

interface ScenarioFormProps {
  initial?: MustPassScenario;
  onSubmit: (prompt: string, expected: string) => void;
  onCancel: () => void;
  submitLabel: string;
}

function ScenarioForm({ initial, onSubmit, onCancel, submitLabel }: ScenarioFormProps) {
  const [prompt, setPrompt] = React.useState(initial?.prompt ?? "");
  const [expected, setExpected] = React.useState(initial?.expected ?? "");
  const trimmed = prompt.trim();
  const trimmedExpected = expected.trim();
  const canSubmit = trimmed.length > 0 && trimmedExpected.length > 0;

  return (
    <div className="border-border bg-surface-muted/30 space-y-4 rounded-[var(--radius-lg)] border p-5">
      <div className="space-y-2">
        <Label htmlFor="mp-prompt">Prompt</Label>
        <Textarea
          id="mp-prompt"
          rows={2}
          placeholder="What would a user actually ask?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mp-expected">Expected behavior</Label>
        <Textarea
          id="mp-expected"
          rows={3}
          placeholder="Plain English. e.g. 'Acknowledges the refund window and links to the policy.'"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSubmit}
          onClick={() => onSubmit(trimmed, trimmedExpected)}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function ResultChip({ result }: { result?: "pass" | "fail" }) {
  if (result === "pass") {
    return (
      <Badge tone="success" className="text-[10px]">
        <Check className="h-3 w-3" />
        Pass
      </Badge>
    );
  }
  if (result === "fail") {
    return (
      <Badge tone="danger" className="text-[10px]">
        <X className="h-3 w-3" />
        Fail
      </Badge>
    );
  }
  return (
    <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
      Not run
    </span>
  );
}

export default function MustPassScenariosPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!params?.id) return;
    setProject(projectStore.get(params.id) ?? ensureDemoProject(params.id));
  }, [params?.id]);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading…</p>
      </main>
    );
  }

  const isOwner = user?.id === project.ownerId;
  if (!isOwner) {
    return (
      <main className="relative flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
          <ShieldCheck className="text-foreground-subtle mb-4 h-8 w-8" />
          <h1 className="font-serif text-3xl tracking-tight">Owner-only area</h1>
          <p className="text-foreground-muted mt-3 max-w-md text-sm">
            Must-Pass Scenarios are set by the project owner. You&apos;ll see the
            results on the playground once training finishes.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href={`/p/${project.id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to project
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  const scenarios = project.mustPass;
  const minRequired = 3;
  const remaining = Math.max(0, minRequired - scenarios.length);
  const meetsMinimum = scenarios.length >= minRequired;

  function persist(next: MustPassScenario[]) {
    if (!project) return;
    const updated = projectStore.update(project.id, { mustPass: next });
    if (updated) setProject(updated);
  }

  function handleAdd(prompt: string, expected: string) {
    persist([...scenarios, { id: shortId(), prompt, expected }]);
    setAdding(false);
  }

  function handleEdit(id: string, prompt: string, expected: string) {
    persist(scenarios.map((s) => (s.id === id ? { ...s, prompt, expected } : s)));
    setEditingId(null);
  }

  function handleRemove(id: string) {
    persist(scenarios.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="border-border mx-auto flex w-full max-w-6xl items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg tracking-tight">
            FFE<span className="text-foreground-subtle">.</span>
          </Link>
          <span className="text-foreground-subtle text-xs">/</span>
          <Link
            href={`/p/${project.id}`}
            className="text-foreground-muted hover:text-foreground truncate text-sm"
          >
            {project.name}
          </Link>
          <span className="text-foreground-subtle text-xs">/</span>
          <span className="text-foreground-muted truncate text-sm">Must-Pass</span>
        </div>
        <TrustBadge />
      </header>

      <section className="mx-auto w-full max-w-3xl px-6 py-10">
        <button
          onClick={() => router.push(`/p/${project.id}`)}
          className="text-foreground-subtle hover:text-foreground mb-6 inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to project
        </button>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
            Owner-only
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Must-Pass Scenarios
          </h1>
          <p className="text-foreground-muted mt-3 max-w-2xl text-base leading-relaxed">
            These are the test cases your trained model must pass. If it fails any,
            you&apos;ll have to review before publishing.
          </p>
        </motion.div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone={meetsMinimum ? "success" : "warning"} outline>
              {scenarios.length} / {minRequired} minimum
            </Badge>
            {!meetsMinimum && (
              <span className="text-foreground-subtle text-xs">
                {remaining === 1
                  ? "Add 1 more to publish."
                  : `Add ${remaining} more to publish.`}
              </span>
            )}
          </div>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Add scenario
            </Button>
          )}
        </div>

        {adding && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4"
          >
            <ScenarioForm
              onSubmit={handleAdd}
              onCancel={() => setAdding(false)}
              submitLabel="Add scenario"
            />
          </motion.div>
        )}

        <section className="mt-6">
          {scenarios.length === 0 && !adding ? (
            <div className="border-border bg-surface text-foreground-muted rounded-[var(--radius-lg)] border border-dashed p-10 text-center text-sm">
              No scenarios yet. Add at least {minRequired} examples your model must
              get right.
            </div>
          ) : (
            <ul className="space-y-3">
              {scenarios.map((s, i) => {
                const isEditing = editingId === s.id;
                if (isEditing) {
                  return (
                    <li key={s.id}>
                      <ScenarioForm
                        initial={s}
                        onSubmit={(prompt, expected) => handleEdit(s.id, prompt, expected)}
                        onCancel={() => setEditingId(null)}
                        submitLabel="Save changes"
                      />
                    </li>
                  );
                }
                return (
                  <li
                    key={s.id}
                    className="border-border bg-surface rounded-[var(--radius-lg)] border p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground-subtle mb-2 flex items-center gap-2 text-[10px] tracking-wider uppercase">
                          <span>Scenario {i + 1}</span>
                          <span>•</span>
                          <ResultChip result={s.result} />
                        </div>
                        <p className="text-sm leading-relaxed font-medium tracking-tight">
                          {s.prompt}
                        </p>
                        <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
                          <span className="text-foreground-subtle">Expected: </span>
                          {s.expected}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit scenario"
                          onClick={() => setEditingId(s.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove scenario"
                          onClick={() => handleRemove(s.id)}
                        >
                          <Trash2 className="text-status-danger h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
