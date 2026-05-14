"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Check, Sparkles, ThumbsDown, ThumbsUp, Minus } from "lucide-react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import {
  SideBySideChat,
  type ChatMessage,
} from "@/components/domain/SideBySideChat";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/domain/MetricCard";
import { AvatarStack } from "@/components/domain/AvatarStack";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePageTitle } from "@/lib/a11y/usePageTitle";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject, seedMustPassResults } from "@/lib/mock/seedDemo";
import { streamMockReply, type MockStream } from "@/lib/mock/mockChat";
import type { Project } from "@/lib/mock/types";

function msgId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

type Vote = "left" | "right" | "neither";

interface Comparison {
  id: string;
  prompt: string;
  vote?: Vote;
  tags: string[];
}

const FEEDBACK_TAGS = [
  "More accurate",
  "Too generic",
  "Wrong tone",
  "Missed policy",
  "Better tone",
  "More concise",
] as const;

function VoteCard({
  comparison,
  onVote,
  onToggleTag,
}: {
  comparison: Comparison;
  onVote: (vote: Vote) => void;
  onToggleTag: (tag: string) => void;
}) {
  const voted = comparison.vote !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="border-border bg-surface mt-4 rounded-[var(--radius-lg)] border p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
            Which was better?
          </p>
          <p className="text-foreground-muted mt-1 line-clamp-1 text-sm">
            <span className="text-foreground-subtle">For:</span> {comparison.prompt}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Button
            variant={comparison.vote === "left" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onVote("left")}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Left better
          </Button>
          <Button
            variant={comparison.vote === "right" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onVote("right")}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Right better
          </Button>
          <Button
            variant={comparison.vote === "neither" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onVote("neither")}
          >
            <Minus className="h-3.5 w-3.5" />
            Neither
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {voted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-border mt-4 border-t pt-4">
              <p className="text-foreground-subtle mb-3 text-[10px] tracking-wider uppercase">
                What stood out? (optional)
              </p>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map((tag) => {
                  const active = comparison.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      className={
                        active
                          ? "bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium tracking-tight"
                          : "border-border text-foreground-muted hover:border-border-strong hover:text-foreground inline-flex items-center gap-1 rounded-[var(--radius-pill)] border bg-transparent px-3 py-1 text-xs font-medium tracking-tight"
                      }
                    >
                      {active && <Check className="h-3 w-3" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ResultPlaygroundPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [leftMessages, setLeftMessages] = React.useState<ChatMessage[]>([]);
  const [rightMessages, setRightMessages] = React.useState<ChatMessage[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [comparisons, setComparisons] = React.useState<Comparison[]>([]);
  const streamsRef = React.useRef<MockStream[]>([]);

  usePageTitle(project ? `Playground · ${project.name}` : "Playground");

  function recordVote(comparisonId: string, vote: Vote) {
    setComparisons((prev) =>
      prev.map((c) => (c.id === comparisonId ? { ...c, vote } : c)),
    );
  }

  function toggleTag(comparisonId: string, tag: string) {
    setComparisons((prev) =>
      prev.map((c) => {
        if (c.id !== comparisonId) return c;
        const has = c.tags.includes(tag);
        return { ...c, tags: has ? c.tags.filter((t) => t !== tag) : [...c.tags, tag] };
      }),
    );
  }

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    const p = projectStore.get(id) ?? ensureDemoProject(id);
    seedMustPassResults(p.id);
    setProject(projectStore.get(id) ?? p);
  }, [params?.id]);

  React.useEffect(() => {
    return () => {
      streamsRef.current.forEach((s) => s.cancel());
    };
  }, []);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading…</p>
      </main>
    );
  }

  function appendAssistantPlaceholder(
    setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  ): string {
    const id = msgId("a");
    setter((prev) => [...prev, { id, role: "assistant", content: "" }]);
    return id;
  }

  function updateMessage(
    setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    id: string,
    content: string,
  ) {
    setter((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }

  async function handleSubmit(prompt: string) {
    const userId = msgId("u");
    const userMsg: ChatMessage = { id: userId, role: "user", content: prompt };
    setLeftMessages((prev) => [...prev, userMsg]);
    setRightMessages((prev) => [...prev, { ...userMsg, id: msgId("u") }]);

    const leftId = appendAssistantPlaceholder(setLeftMessages);
    const rightId = appendAssistantPlaceholder(setRightMessages);

    setBusy(true);
    const leftStream = streamMockReply(prompt, "left", (text) =>
      updateMessage(setLeftMessages, leftId, text),
    );
    const rightStream = streamMockReply(prompt, "right", (text) =>
      updateMessage(setRightMessages, rightId, text),
    );
    streamsRef.current.push(leftStream, rightStream);

    await Promise.all([leftStream.done, rightStream.done]);
    setBusy(false);
    setComparisons((prev) => [
      ...prev,
      { id: msgId("cmp"), prompt, tags: [] },
    ]);
  }

  const latestComparison = comparisons[comparisons.length - 1];
  const contributors = project?.contributors ?? [];
  const trainedBy = contributors.filter(
    (c) => c.status === "included" || c.status === "validated" || c.role === "owner",
  );
  const trainedByNames = trainedBy
    .slice(0, 3)
    .map((c) => c.name.split(" ")[0])
    .filter(Boolean) as string[];
  const trainedByLabel =
    trainedByNames.length === 0
      ? "Trained by your team"
      : trainedByNames.length === 1
        ? `Trained by ${trainedByNames[0]}`
        : trainedByNames.length === 2
          ? `Trained by ${trainedByNames[0]} and ${trainedByNames[1]}`
          : `Trained by ${trainedByNames.slice(0, -1).join(", ")}, and ${trainedByNames.slice(-1)[0]}`;

  const mustPass = project?.mustPass ?? [];
  const mustPassPassed = mustPass.filter((s) => s.result === "pass").length;

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
          <span className="text-foreground-muted truncate text-sm">Playground</span>
        </div>
        <TrustBadge />
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link
          href={`/p/${project.id}`}
          className="text-foreground-subtle hover:text-foreground mb-6 inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to project
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <p className="text-foreground-subtle mb-3 inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            New version ready
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Try the new version
          </h1>
          <p className="text-foreground-muted mt-3 max-w-2xl text-base leading-relaxed">
            Ask both versions the same question and compare. The right column is
            the new model trained on this round&apos;s contributions.
            {user?.displayName ? ` Welcome, ${user.displayName.split(" ")[0]}.` : ""}
          </p>

          <div className="border-border bg-surface mt-6 inline-flex items-center gap-3 rounded-[var(--radius-pill)] border px-3 py-1.5">
            <AvatarStack
              size="sm"
              max={5}
              people={trainedBy.map((c) => ({ id: c.id, name: c.name }))}
            />
            <span className="text-foreground-muted text-xs">{trainedByLabel}</span>
          </div>
        </motion.div>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            value="78%"
            description="Won 78% of comparisons against the previous version."
            trend="up"
            trendLabel="+12 pts"
          />
          <MetricCard
            value="Refunds"
            description="Improved refund-policy answers across the test set."
            trend="up"
            trendLabel="better"
          />
          <MetricCard
            value="Cancellations"
            description="Regressed on cancellation questions — review before publishing."
            trend="down"
            trendLabel="watch"
          />
        </section>

        {mustPass.length > 0 && (
          <section className="border-border bg-surface mb-6 rounded-[var(--radius-lg)] border p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
                  Must-Pass Scenarios
                </p>
                <p className="text-sm font-medium tracking-tight">
                  {mustPassPassed} of {mustPass.length} pass
                </p>
              </div>
              <Badge
                tone={mustPassPassed === mustPass.length ? "success" : "warning"}
                outline
              >
                {mustPassPassed === mustPass.length ? "All pass" : "Needs review"}
              </Badge>
            </div>
            <ul className="flex flex-wrap gap-2">
              {mustPass.map((s) => {
                const passed = s.result === "pass";
                const failed = s.result === "fail";
                return (
                  <li
                    key={s.id}
                    title={s.prompt}
                    className={
                      passed
                        ? "bg-[var(--status-success-bg)] text-status-success inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs"
                        : failed
                          ? "bg-[var(--status-danger-bg)] text-status-danger inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs"
                          : "bg-surface-muted text-foreground-muted inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs"
                    }
                  >
                    {passed ? (
                      <Check className="h-3 w-3 shrink-0" />
                    ) : failed ? (
                      <span className="text-status-danger inline-block h-3 w-3 shrink-0 leading-3">
                        ✕
                      </span>
                    ) : (
                      <Minus className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate">{s.prompt}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <SideBySideChat
          leftMessages={leftMessages}
          rightMessages={rightMessages}
          onSubmit={handleSubmit}
          busy={busy}
          footer={
            latestComparison ? (
              <VoteCard
                comparison={latestComparison}
                onVote={(v) => recordVote(latestComparison.id, v)}
                onToggleTag={(t) => toggleTag(latestComparison.id, t)}
              />
            ) : null
          }
        />

        {comparisons.filter((c) => c.vote).length > 0 && (
          <p className="text-foreground-subtle mt-4 inline-flex items-center gap-1.5 text-xs">
            <ThumbsDown className="h-3 w-3 -rotate-180" />
            {comparisons.filter((c) => c.vote).length} comparison
            {comparisons.filter((c) => c.vote).length === 1 ? "" : "s"} recorded
          </p>
        )}
      </section>
    </main>
  );
}
