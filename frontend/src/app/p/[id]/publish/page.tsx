"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Rocket,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AvatarStack } from "@/components/domain/AvatarStack";
import { Confetti } from "@/components/domain/Confetti";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePageTitle } from "@/lib/a11y/usePageTitle";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject, seedMustPassResults } from "@/lib/mock/seedDemo";
import type { Project, ProjectVersion } from "@/lib/mock/types";

function vId() {
  return `v_${Math.random().toString(36).slice(2, 8)}`;
}

function nextVersionLabel(existing: ProjectVersion[]) {
  return `Version ${existing.length + 1}`;
}

function summaryFromMustPass(passed: number, total: number) {
  if (total === 0) return "Initial run.";
  if (passed === total) return "All Must-Pass Scenarios pass.";
  const failed = total - passed;
  return failed === 1
    ? "Improved overall — 1 Must-Pass regression to review."
    : `Improved overall — ${failed} Must-Pass regressions to review.`;
}

function PublishedReceipt({ project }: { project: Project }) {
  const { user } = useAuth();
  const me = user
    ? project.contributors.find((c) => c.id === user.id)
    : undefined;
  const teammates = project.contributors.filter((c) => c.id !== me?.id);
  const latest = project.versions[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="mt-8"
    >
      <div className="border-border bg-surface rounded-[var(--radius-lg)] border p-8 text-center shadow-[var(--shadow-md)]">
        <div className="bg-[var(--status-success-bg)] text-status-success mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-foreground-subtle mt-5 text-xs tracking-[0.18em] uppercase">
          Published
        </p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
          {latest?.label ?? "New version"} is live
        </h2>
        <p className="text-foreground-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
          {latest?.summary}
        </p>
      </div>

      {me && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="bg-accent text-accent-foreground mt-6 rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-md)]"
        >
          <p className="text-accent-foreground/70 text-xs tracking-[0.18em] uppercase">
            Your receipt
          </p>
          <p className="mt-2 font-serif text-2xl tracking-tight">
            Your data was included in this shared improvement.
          </p>
          <p className="text-accent-foreground/80 mt-2 text-sm">
            Thanks, {me.name.split(" ")[0]}. Your contribution is in
            {latest ? ` ${latest.label}` : " this version"} alongside{" "}
            {teammates.length} teammate{teammates.length === 1 ? "" : "s"}.
          </p>
        </motion.div>
      )}

      <div className="border-border bg-surface mt-6 rounded-[var(--radius-lg)] border p-6">
        <p className="text-foreground-subtle text-xs tracking-[0.18em] uppercase">
          Contributor receipts
        </p>
        <ul className="divide-border mt-4 divide-y">
          {project.contributors.map((c) => {
            const included = latest?.contributorIds.includes(c.id);
            return (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <AvatarStack size="sm" people={[{ id: c.id, name: c.name }]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium tracking-tight">{c.name}</p>
                  <p className="text-foreground-subtle truncate text-xs">
                    {included
                      ? "Your data was included in this shared improvement."
                      : "Did not contribute to this round."}
                  </p>
                </div>
                {included ? (
                  <Badge tone="success" outline className="text-[10px]">
                    <Check className="h-3 w-3" />
                    Included
                  </Badge>
                ) : (
                  <Badge className="text-[10px]">—</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href={`/p/${project.id}/versions`}>
            See version timeline
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/p/${project.id}`}>Back to project</Link>
        </Button>
      </div>
    </motion.section>
  );
}

export default function PublishPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [override, setOverride] = React.useState(false);
  const [justPublished, setJustPublished] = React.useState(false);

  usePageTitle(justPublished ? "Published" : "Publish");

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    const p = projectStore.get(id) ?? ensureDemoProject(id);
    seedMustPassResults(p.id);
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

  if (!isOwner) {
    return (
      <main className="relative flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
          <ShieldCheck className="text-foreground-subtle mb-4 h-8 w-8" />
          <h1 className="font-serif text-3xl tracking-tight">Owner-only step</h1>
          <p className="text-foreground-muted mt-3 max-w-md text-sm">
            Only the project owner can publish a new version. You&apos;ll see the
            results on the timeline once it&apos;s live.
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

  const mustPass = project.mustPass;
  const passed = mustPass.filter((s) => s.result === "pass").length;
  const failed = mustPass.filter((s) => s.result === "fail");
  const allPass = mustPass.length > 0 && failed.length === 0;
  const meetsMinimum = mustPass.length >= 3;
  const canPublish = (allPass && meetsMinimum) || (override && meetsMinimum);

  function publish() {
    if (!project) return;
    if (!canPublish || !user) return;
    const version: ProjectVersion = {
      id: vId(),
      label: nextVersionLabel(project.versions),
      summary: summaryFromMustPass(passed, mustPass.length),
      publishedAt: new Date().toISOString(),
      publishedBy: user.displayName,
      publishedById: user.id,
      mustPassPassed: passed,
      mustPassTotal: mustPass.length,
      contributorIds: project.contributors
        .filter(
          (c) =>
            c.status === "included" || c.status === "validated" || c.role === "owner",
        )
        .map((c) => c.id),
      ...(override && !allPass ? { overridden: true } : {}),
    };
    const updated = projectStore.update(project.id, {
      versions: [version, ...project.versions],
      stage: "ready",
    });
    if (updated) {
      setProject(updated);
      setJustPublished(true);
    }
  }

  function rerun() {
    if (!project) return;
    projectStore.update(project.id, { stage: "waiting" });
    router.push(`/p/${project.id}`);
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
          <span className="text-foreground-muted truncate text-sm">Publish</span>
        </div>
        <TrustBadge />
      </header>

      <section className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          href={`/p/${project.id}`}
          className="text-foreground-subtle hover:text-foreground mb-6 inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to project
        </Link>

        <AnimatePresence mode="wait">
          {!justPublished ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
                Owner-only
              </p>
              <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
                Publish or run another round?
              </h1>
              <p className="text-foreground-muted mt-3 max-w-2xl text-base leading-relaxed">
                Publishing makes the new version available to your whole team and
                logs it in the timeline. Running another round resets the project
                so contributors can add more examples.
              </p>

              <section className="border-border bg-surface mt-8 rounded-[var(--radius-lg)] border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
                      Must-Pass Scenarios
                    </p>
                    <p className="text-sm font-medium tracking-tight">
                      {passed} of {mustPass.length} pass
                    </p>
                  </div>
                  {!meetsMinimum ? (
                    <Badge tone="warning" outline>
                      <TriangleAlert className="h-3 w-3" />
                      Set at least 3
                    </Badge>
                  ) : allPass ? (
                    <Badge tone="success" outline>
                      <Check className="h-3 w-3" />
                      All pass
                    </Badge>
                  ) : (
                    <Badge tone="danger" outline>
                      <X className="h-3 w-3" />
                      {failed.length} regression{failed.length === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>

                {!meetsMinimum && (
                  <div className="border-border mt-4 border-t pt-4">
                    <p className="text-foreground-muted text-sm">
                      You need at least 3 Must-Pass Scenarios before publishing.
                    </p>
                    <Button asChild variant="secondary" size="sm" className="mt-3">
                      <Link href={`/p/${project.id}/scenarios`}>
                        Set scenarios
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                )}

                {meetsMinimum && !allPass && (
                  <div className="border-border mt-4 space-y-3 border-t pt-4">
                    <p className="text-foreground-muted text-sm">
                      The new version regressed on these scenarios:
                    </p>
                    <ul className="space-y-1.5">
                      {failed.map((s) => (
                        <li
                          key={s.id}
                          className="text-foreground flex items-start gap-2 text-sm"
                        >
                          <X className="text-status-danger mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="leading-snug">{s.prompt}</span>
                        </li>
                      ))}
                    </ul>
                    <label className="text-foreground-muted mt-2 flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={override}
                        onChange={(e) => setOverride(e.target.checked)}
                        className="border-border-strong mt-0.5 h-4 w-4 rounded"
                      />
                      <span>
                        Publish anyway — I&apos;ve reviewed the regressions and
                        understand they&apos;re on the record.
                      </span>
                    </label>
                  </div>
                )}
              </section>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={publish}
                  disabled={!canPublish}
                  className="border-border bg-accent text-accent-foreground hover:bg-accent-hover relative flex flex-col items-start gap-2 rounded-[var(--radius-lg)] border p-6 text-left shadow-[var(--shadow-md)] transition-[transform,background-color,box-shadow] duration-150 ease-[var(--ease-out-expo)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
                >
                  <Rocket className="h-5 w-5" />
                  <span className="font-serif text-2xl tracking-tight">
                    Publish this version
                  </span>
                  <span className="text-accent-foreground/75 text-sm leading-snug">
                    Make {nextVersionLabel(project.versions)} the live model and
                    notify your team.
                  </span>
                  {override && !allPass && (
                    <span className="bg-accent-foreground/15 text-accent-foreground absolute top-3 right-3 inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-medium">
                      Override
                    </span>
                  )}
                </button>

                <button
                  onClick={rerun}
                  className="border-border bg-surface hover:border-border-strong hover:bg-surface-muted flex flex-col items-start gap-2 rounded-[var(--radius-lg)] border p-6 text-left transition-[transform,background-color,border-color] duration-150 ease-[var(--ease-out-expo)] active:scale-[0.99]"
                >
                  <RotateCcw className="h-5 w-5" />
                  <span className="font-serif text-2xl tracking-tight">
                    Run another round
                  </span>
                  <span className="text-foreground-muted text-sm leading-snug">
                    Reset to waiting so contributors can add more examples.
                  </span>
                </button>
              </div>
            </motion.div>
          ) : (
            <PublishedReceipt key="receipt" project={project} />
          )}
        </AnimatePresence>
      </section>
      {justPublished && <Confetti />}
    </main>
  );
}
