"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Rocket,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { UserPill } from "@/components/auth/UserPill";
import { AvatarStack } from "@/components/domain/AvatarStack";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePageTitle } from "@/lib/a11y/usePageTitle";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject, seedDemoVersions } from "@/lib/mock/seedDemo";
import type { Project, ProjectVersion } from "@/lib/mock/types";

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  if (diff < hour) return "just now";
  if (diff < day) {
    const h = Math.round(diff / hour);
    return `${h}h ago`;
  }
  const d = Math.round(diff / day);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

interface VersionRowProps {
  version: ProjectVersion;
  isLatest: boolean;
  isLive: boolean;
  isOwner: boolean;
  project: Project;
  onRollback: (versionId: string) => void;
}

function VersionRow({
  version,
  isLatest,
  isLive,
  isOwner,
  project,
  onRollback,
}: VersionRowProps) {
  const [expanded, setExpanded] = React.useState(isLive);
  const contributors = project.contributors.filter((c) =>
    version.contributorIds.includes(c.id),
  );
  const votes = version.voteSummary;
  const voteTotal = votes ? votes.left + votes.right + votes.neither : 0;
  const winRate =
    votes && voteTotal > 0
      ? Math.round((votes.right / voteTotal) * 100)
      : null;

  return (
    <li className="relative pl-8">
      <span
        aria-hidden
        className={
          isLive
            ? "border-accent bg-accent absolute top-5 left-0 inline-flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 shadow-[var(--shadow-sm)]"
            : "border-border-strong bg-surface absolute top-5 left-0 inline-block h-3 w-3 -translate-x-1/2 rounded-full border-2"
        }
      >
        {isLive && (
          <Sparkles className="text-accent-foreground h-2.5 w-2.5" />
        )}
      </span>

      <div
        className={
          isLive
            ? "border-accent/40 bg-surface rounded-[var(--radius-lg)] border-2 p-5 shadow-[var(--shadow-sm)]"
            : "border-border bg-surface rounded-[var(--radius-lg)] border p-5"
        }
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-serif text-xl tracking-tight">
                {version.label}
              </span>
              {isLive && (
                <Badge tone="accent" outline className="text-[10px]">
                  Live
                </Badge>
              )}
              {version.overridden && (
                <Badge tone="warning" outline className="text-[10px]">
                  Override
                </Badge>
              )}
              <Badge
                tone={
                  version.mustPassPassed === version.mustPassTotal
                    ? "success"
                    : "warning"
                }
                outline
                className="text-[10px]"
              >
                Must-Pass: {version.mustPassPassed}/{version.mustPassTotal}
              </Badge>
            </div>
            <p className="text-foreground-muted text-sm leading-relaxed">
              {version.summary}
            </p>
            <p className="text-foreground-subtle mt-2 text-xs">
              Published by {version.publishedBy} · {relativeTime(version.publishedAt)}
            </p>
          </div>
          <ChevronDown
            className={
              expanded
                ? "text-foreground-muted h-4 w-4 shrink-0 rotate-180 transition-transform"
                : "text-foreground-muted h-4 w-4 shrink-0 transition-transform"
            }
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="border-border mt-4 space-y-4 border-t pt-4">
                <div>
                  <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
                    Contributors
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <AvatarStack
                      size="sm"
                      max={6}
                      people={contributors.map((c) => ({ id: c.id, name: c.name }))}
                    />
                    <span className="text-foreground-muted text-xs">
                      {contributors.length === 0
                        ? "—"
                        : contributors.map((c) => c.name.split(" ")[0]).join(", ")}
                    </span>
                  </div>
                </div>

                {votes && (
                  <div>
                    <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
                      Vote results
                    </p>
                    <div className="text-foreground mt-2 flex flex-wrap gap-3 text-xs">
                      <span>
                        <span className="font-medium">{votes.right}</span>{" "}
                        <span className="text-foreground-muted">this version</span>
                      </span>
                      <span>
                        <span className="font-medium">{votes.left}</span>{" "}
                        <span className="text-foreground-muted">previous</span>
                      </span>
                      <span>
                        <span className="font-medium">{votes.neither}</span>{" "}
                        <span className="text-foreground-muted">neither</span>
                      </span>
                      {winRate !== null && (
                        <span className="text-foreground-muted">·</span>
                      )}
                      {winRate !== null && (
                        <span className="text-foreground">
                          {winRate}% win rate
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/p/${project.id}/result?v=${version.id}`}>
                      Try this version
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  {isOwner && !isLive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRollback(version.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Roll back to this version
                    </Button>
                  )}
                  {isLatest && !isLive && (
                    <Badge className="text-[10px]">Latest</Badge>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

export default function VersionsPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);

  usePageTitle("Versions");

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    const p = projectStore.get(id) ?? ensureDemoProject(id);
    seedDemoVersions(p.id);
    setProject(projectStore.get(id) ?? p);
  }, [params?.id]);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading…</p>
      </main>
    );
  }

  const isOwner = user?.id === project.ownerId;

  function handleRollback(versionId: string) {
    if (!project || !isOwner) return;
    const idx = project.versions.findIndex((v) => v.id === versionId);
    if (idx <= 0) return;
    const target = project.versions[idx];
    if (!target) return;
    const reordered = [
      { ...target, label: `${target.label} (rolled back)` },
      ...project.versions.filter((v) => v.id !== versionId),
    ];
    const updated = projectStore.update(project.id, { versions: reordered });
    if (updated) setProject(updated);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="border-border mx-auto flex w-full max-w-7xl items-center justify-between border-b px-6 py-4">
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
          <span className="text-foreground-muted truncate text-sm">Versions</span>
        </div>
        <div className="flex items-center gap-3"><TrustBadge /><UserPill /></div>      </header>

      <section className="mx-auto w-full max-w-3xl px-6 py-10">
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
          <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
            History
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Version timeline
          </h1>
          <p className="text-foreground-muted mt-3 max-w-2xl text-base leading-relaxed">
            Every published result is a version, and every change is reversible.
          </p>
        </motion.div>

        {project.versions.length === 0 ? (
          <div className="border-border bg-surface text-foreground-muted rounded-[var(--radius-lg)] border border-dashed p-10 text-center text-sm">
            No versions yet.{" "}
            {isOwner && (
              <Link
                href={`/p/${project.id}/publish`}
                className="text-accent underline-offset-4 hover:underline"
              >
                Publish your first version
                <Rocket className="ml-1 inline-block h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <ul className="border-border relative space-y-4 border-l pl-0">
            {project.versions.map((v, i) => (
              <VersionRow
                key={v.id}
                version={v}
                isLatest={i === 0}
                isLive={i === 0}
                isOwner={isOwner}
                project={project}
                onRollback={handleRollback}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
