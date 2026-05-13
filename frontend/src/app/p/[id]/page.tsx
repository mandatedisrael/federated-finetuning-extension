"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { ProgressBar, PROJECT_STAGES } from "@/components/domain/ProgressBar";
import { StatusChip } from "@/components/domain/StatusChip";
import { AvatarStack } from "@/components/domain/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  FastForward,
  Upload,
  ArrowRight,
  Sparkles,
  Check,
  Circle,
  AlertCircle,
  Settings,
  Copy,
} from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject, seedSampleProgress } from "@/lib/mock/seedDemo";
import { getTemplate } from "@/lib/mock/templates";
import type { Project } from "@/lib/mock/types";

function ProjectSettingsButton({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (p: Project) => void;
}) {
  const [goal, setGoal] = React.useState(project.goal);
  const [deadline, setDeadline] = React.useState(project.deadline);
  const [stake, setStake] = React.useState(project.stakeUsd);
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => setOrigin(window.location.origin), []);

  function save() {
    const updated = projectStore.update(project.id, {
      goal: goal.trim(),
      deadline,
      stakeUsd: stake,
    });
    if (updated) onUpdate(updated);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${origin}/join?code=${project.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Project settings">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Project settings</SheetTitle>
          <SheetDescription>Owner-only. Changes save when you click Save.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="set-goal">Goal</Label>
            <Textarea
              id="set-goal"
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-deadline">Deadline</Label>
            <Input
              id="set-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-stake">Deposit (USD)</Label>
            <Input
              id="set-stake"
              type="number"
              min={0}
              value={stake}
              onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>

          <div className="border-border space-y-2 border-t pt-4">
            <Label>Invite link</Label>
            <div className="border-border bg-surface-muted/40 flex items-center gap-2 rounded-[var(--radius-md)] border p-2">
              <code className="text-foreground-muted flex-1 truncate font-mono text-xs">
                {origin}/join?code={project.inviteCode}
              </code>
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="ghost">Cancel</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button onClick={save}>Save</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    const p = projectStore.get(id) ?? ensureDemoProject(id);
    // demo polish: seed contributor statuses the first time
    if (p.contributors.every((c) => c.status === "not-started")) {
      seedSampleProgress(p.id);
    }
    setProject(projectStore.get(id) ?? null);
  }, [params?.id]);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading project…</p>
      </main>
    );
  }

  const template = getTemplate(project.templateId);
  const isOwner = user?.id === project.ownerId;

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="border-border mx-auto flex w-full max-w-6xl items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg tracking-tight">
            FFE<span className="text-foreground-subtle">.</span>
          </Link>
          <span className="text-foreground-subtle text-xs">/</span>
          <span className="text-foreground-muted truncate text-sm">{project.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {isOwner ? (
            <Badge tone="accent" outline>
              Owner
            </Badge>
          ) : (
            <Badge>Contributor</Badge>
          )}
          {isOwner && <ProjectSettingsButton project={project} onUpdate={(p) => setProject(p)} />}
          <TrustBadge />
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {template && (
            <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
              {template.name}
            </p>
          )}
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{project.name}</h1>
          <p className="text-foreground-muted mt-3 max-w-2xl text-base leading-relaxed">
            {project.goal}
          </p>
        </motion.div>

        {(() => {
          const me = user ? project.contributors.find((c) => c.id === user.id) : undefined;
          if (!me) return null;
          const isWaitingOnYou = project.stage === "waiting" && me.status === "not-started";
          const isReady = project.stage === "ready";
          const headline = isWaitingOnYou
            ? "You're up."
            : isReady
              ? "The new version is ready."
              : `Status: ${me.status.replace(/-/g, " ")}`;
          const sub = isWaitingOnYou
            ? "Add your training examples to keep the project moving."
            : isReady
              ? "Try the new model side-by-side and vote."
              : "We'll update you when the project changes stage.";
          const ctaHref = isReady ? `/p/${project.id}/result` : `/p/${project.id}/contribute`;
          const ctaLabel = isReady ? "Try the new version" : "Go contribute";
          const ctaIcon = isReady ? Sparkles : Upload;

          return (
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={
                isWaitingOnYou
                  ? "bg-accent text-accent-foreground mt-8 flex flex-col items-start justify-between gap-3 rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-md)] sm:flex-row sm:items-center"
                  : "border-border bg-surface mt-8 flex flex-col items-start justify-between gap-3 rounded-[var(--radius-lg)] border p-5 sm:flex-row sm:items-center"
              }
            >
              <div>
                <p
                  className={
                    isWaitingOnYou
                      ? "text-accent-foreground/70 mb-1 text-xs tracking-widest uppercase"
                      : "text-foreground-subtle mb-1 text-xs tracking-widest uppercase"
                  }
                >
                  Your next action
                </p>
                <h2 className="text-lg font-medium tracking-tight">{headline}</h2>
                <p
                  className={
                    isWaitingOnYou
                      ? "text-accent-foreground/80 mt-1 text-sm"
                      : "text-foreground-muted mt-1 text-sm"
                  }
                >
                  {sub}
                </p>
              </div>
              <Button
                asChild
                variant={isWaitingOnYou ? "secondary" : "primary"}
                className={
                  isWaitingOnYou
                    ? "text-foreground border-transparent bg-white hover:bg-white/90"
                    : ""
                }
              >
                <Link href={ctaHref}>
                  {React.createElement(ctaIcon, { className: "h-4 w-4" })}
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.section>
          );
        })()}

        <section className="border-border bg-surface mt-6 rounded-[var(--radius-lg)] border p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium tracking-tight">Progress</h2>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const i = PROJECT_STAGES.indexOf(project.stage);
                  const next = PROJECT_STAGES[Math.min(i + 1, PROJECT_STAGES.length - 1)];
                  if (next) {
                    const updated = projectStore.update(project.id, { stage: next });
                    if (updated) setProject(updated);
                  }
                }}
              >
                <FastForward className="h-3.5 w-3.5" />
                Advance (demo)
              </Button>
            )}
          </div>
          <ProgressBar stage={project.stage} />

          {(() => {
            const uploaded = project.contributors.filter((c) => c.status !== "not-started").length;
            const total = project.contributors.length;
            const mustPassSet = project.mustPass.length >= 3;
            const daysLeft = Math.max(
              0,
              Math.round(
                (new Date(project.deadline + "T23:59:59").getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              ),
            );
            const items = [
              {
                ok: uploaded === total,
                warn: uploaded > 0 && uploaded < total,
                label: `${uploaded} of ${total} contributors uploaded`,
              },
              {
                ok: mustPassSet,
                warn: false,
                label: mustPassSet ? "Must-Pass Scenarios set" : "Must-Pass Scenarios not yet set",
              },
              {
                ok: daysLeft > 1,
                warn: daysLeft <= 1,
                label:
                  daysLeft === 0
                    ? "Deadline is today"
                    : daysLeft === 1
                      ? "Deadline is tomorrow"
                      : `Deadline in ${daysLeft} days`,
              },
            ];
            return (
              <ul className="border-border mt-6 grid gap-2 border-t pt-5 text-sm sm:grid-cols-3">
                {items.map((it, i) => {
                  const Icon = it.ok ? Check : it.warn ? AlertCircle : Circle;
                  return (
                    <li
                      key={i}
                      className={
                        it.ok
                          ? "text-foreground flex items-center gap-2"
                          : it.warn
                            ? "text-status-warning flex items-center gap-2"
                            : "text-foreground-subtle flex items-center gap-2"
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-xs tracking-tight">{it.label}</span>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </section>

        <section className="border-border bg-surface mt-6 rounded-[var(--radius-lg)] border">
          <header className="border-border flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-sm font-medium tracking-tight">
              Contributors
              <span className="text-foreground-subtle ml-2 font-normal">
                {project.contributors.length}
              </span>
            </h2>
            <AvatarStack
              size="sm"
              people={project.contributors.map((c) => ({ id: c.id, name: c.name }))}
              max={6}
            />
          </header>
          <ul className="divide-border divide-y">
            {project.contributors.map((c) => {
              const isYou = user?.id === c.id;
              return (
                <li key={c.id} className="flex items-center gap-3 px-6 py-3">
                  <AvatarStack size="sm" people={[{ id: c.id, name: c.name }]} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="font-medium tracking-tight">{c.name}</span>
                      {isYou && (
                        <Badge tone="accent" outline className="text-[10px]">
                          You
                        </Badge>
                      )}
                      {c.role === "owner" && <Badge className="text-[10px]">Owner</Badge>}
                    </p>
                    <p className="text-foreground-subtle truncate text-xs">{c.email}</p>
                  </div>
                  <span className="text-foreground-subtle text-xs tabular-nums">
                    {c.exampleCount > 0 ? `${c.exampleCount} examples` : "—"}
                  </span>
                  <StatusChip status={c.status} />
                </li>
              );
            })}
          </ul>
        </section>
      </section>
    </main>
  );
}
