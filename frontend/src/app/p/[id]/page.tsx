"use client";

import * as React from "react";
import { useWallets } from "@privy-io/react-auth";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { UserPill } from "@/components/auth/UserPill";
import { ProgressBar, PROJECT_STAGES } from "@/components/domain/ProgressBar";
import { StatusChip } from "@/components/domain/StatusChip";
import { AvatarStack } from "@/components/domain/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  FastForward,
  Loader2,
  Play,
  Upload,
  ArrowRight,
  Sparkles,
  Check,
  Circle,
  AlertCircle,
  Settings,
  Copy,
  BrainCircuit,
  ShieldCheck,
  Ban,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/Dialog";
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
import { usePageTitle } from "@/lib/a11y/usePageTitle";
import {
  cancelFfeSession,
  createFfeProjectSession,
  getFfeSessionStatus,
} from "@/lib/ffe/client";
import { createBrowserFfeKeyPair } from "@/lib/ffe/keys";
import { projectStore } from "@/lib/mock/projectStore";
import { loadProject, updateProject } from "@/lib/projects/client";
import { ensureDemoProject, seedSampleProgress } from "@/lib/mock/seedDemo";
import { getTemplate } from "@/lib/mock/templates";
import type { FfeSessionStatusResult } from "@/lib/ffe/types";
import type { Project } from "@/lib/mock/types";

function isContributorRegistered(project: Project, contributorId: string) {
  const contributor = project.contributors.find((entry) => entry.id === contributorId);
  return !!(contributor?.walletAddress && contributor?.ffePublicKey && contributor?.registeredAt);
}

function ProjectSettingsButton({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (p: Project) => void;
}) {
  const isSoloProject = project.contributors.every((contributor) => contributor.role === "owner");
  const [goal, setGoal] = React.useState(project.goal);
  const [deadline, setDeadline] = React.useState(project.deadline);
  const [copied, setCopied] = React.useState(false);
  const [origin] = React.useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );

  async function save() {
    const updated = projectStore.update(project.id, {
      goal: goal.trim(),
      deadline,
    });
    if (updated) onUpdate(updated);
    await updateProject(project.id, {
      goal: goal.trim(),
      deadline,
    }).catch((err) => console.warn("Could not persist project settings.", err));
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
          {!isSoloProject && (
            <div className="space-y-2">
              <Label htmlFor="set-deadline">Deadline</Label>
              <Input
                id="set-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          )}
          <div className="border-border bg-surface-muted/40 rounded-[var(--radius-md)] border border-dashed p-3">
            <p className="text-foreground text-sm font-medium tracking-tight">Deposits</p>
            <p className="text-foreground-muted mt-1 text-xs leading-relaxed">
              Planned for a later release. No contributor deposit is enforced right now.
            </p>
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

function TrainingShowcase({
  project,
  sessionStatus,
  isOwner,
  onCancelled,
}: {
  project: Project;
  sessionStatus: FfeSessionStatusResult | null;
  isOwner: boolean;
  onCancelled: (reason: string) => void;
}) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelBusy, setCancelBusy] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const sessionId = project.chainSession?.sessionId;

  async function handleCancel() {
    if (!sessionId) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelFfeSession(sessionId, "Cancelled by owner from dashboard");
      onCancelled("Cancelled by owner.");
      setCancelOpen(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Cancellation failed.");
    } finally {
      setCancelBusy(false);
    }
  }

  const contributors = project.contributors.slice(0, 6);
  const runtimeLogs =
    sessionStatus?.runtimeLogs?.length
      ? [...sessionStatus.runtimeLogs].slice(-8).reverse()
      : [
          {
            message: "Waiting for the next backend checkpoint...",
            timestamp: new Date().toISOString(),
            tone: "info" as const,
            phase: "training",
          },
        ];

  const toneClasses: Record<string, string> = {
    success:
      "border-[color:var(--status-success)]/20 bg-[var(--status-success-bg)] text-[color:var(--status-success)]",
    warning:
      "border-[color:var(--status-warning)]/20 bg-[var(--status-warning-bg)] text-[color:var(--status-warning)]",
    error:
      "border-[color:var(--status-danger)]/20 bg-[var(--status-danger-bg)] text-[color:var(--status-danger)]",
    info: "border-[color:var(--accent)]/20 bg-[var(--status-progress-bg)] text-[color:var(--status-progress)]",
  };

  function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
  }

  const contributorSignals = contributors.map((contributor, index) => {
    const isSubmitted =
      !!contributor.walletAddress &&
      sessionStatus?.submitters.some(
        (submitter) => submitter.toLowerCase() === contributor.walletAddress?.toLowerCase(),
      );
    const isRegistered =
      contributor.role === "owner" || !!(contributor.walletAddress && contributor.ffePublicKey);
    const angle = (Math.PI * 2 * index) / Math.max(contributors.length, 1) - Math.PI / 2;
    const radius = contributors.length <= 2 ? 118 : 138;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    return {
      contributor,
      isSubmitted,
      isRegistered,
      x,
      y,
      pulseDelay: index * 0.18,
      label: isSubmitted
        ? "Committed"
        : isRegistered
          ? "Encrypted"
          : "Awaiting",
    };
  });

  const latestMessage = runtimeLogs[0]?.message ?? "Waiting for the first live training event.";

  const toneDotClasses: Record<string, string> = {
    success: "bg-[color:var(--status-success)]",
    warning: "bg-[color:var(--status-warning)]",
    error: "bg-[color:var(--status-danger)]",
    info: "bg-[color:var(--accent)]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="border-border bg-surface text-foreground relative mt-5 overflow-hidden rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-md)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="info">
            <motion.span
              className="bg-accent inline-block h-1.5 w-1.5 rounded-full"
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.1, 0.85] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            Training live
          </Badge>
          <span className="text-foreground-subtle text-xs tracking-[0.18em] uppercase">
            Federated run
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">
            {sessionStatus
              ? `${sessionStatus.submittedCount}/${sessionStatus.quorum} acknowledged`
              : "Syncing"}
          </Badge>
          {isOwner && sessionId && (
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-[color:var(--status-danger)]">
                  <Ban className="h-3.5 w-3.5" />
                  Cancel session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel this training run?</DialogTitle>
                  <DialogDescription>
                    The aggregator will stop the in-flight fine-tuning task and mark this session
                    as failed. Contributors will see the run as cancelled and the trained adapter
                    will not be minted. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                {cancelError && (
                  <p className="text-status-danger mt-2 text-xs">{cancelError}</p>
                )}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" disabled={cancelBusy}>
                      Keep training
                    </Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    onClick={() => void handleCancel()}
                    disabled={cancelBusy}
                    className="bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/90"
                  >
                    {cancelBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                    Cancel session
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-foreground-subtle text-xs tracking-[0.18em] uppercase">
          Contributor flow
        </p>
        <p className="text-foreground mt-1 text-lg font-medium tracking-tight">
          Multiple encrypted contributors are feeding one shared model.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="border-border bg-surface-muted/40 rounded-[var(--radius-lg)] border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-foreground-subtle text-xs tracking-[0.18em] uppercase">
              Federated signal map
            </p>
            <span className="text-foreground-muted text-xs">
              {contributors.length} contributor{contributors.length === 1 ? "" : "s"} feeding one
              shared run
            </span>
          </div>

          <div className="border-border bg-surface relative mt-4 flex min-h-[24rem] items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border">
            <motion.div
              className="border-accent/15 absolute h-48 w-48 rounded-full border"
              animate={{ scale: [0.94, 1.06, 0.94], opacity: [0.35, 0.75, 0.35] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="border-accent/10 absolute h-72 w-72 rounded-full border"
              animate={{ scale: [1, 1.04, 1], opacity: [0.25, 0.55, 0.25] }}
              transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="border-accent/8 absolute h-[22rem] w-[22rem] rounded-full border border-dashed"
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            />

            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {contributorSignals.map((signal) => {
                const startX = 50 + signal.x / 4.7;
                const startY = 50 + signal.y / 4.7;
                return (
                  <line
                    key={`line-${signal.contributor.id}`}
                    x1={`${startX}%`}
                    y1={`${startY}%`}
                    x2="50%"
                    y2="50%"
                    stroke={
                      signal.isSubmitted
                        ? "var(--accent)"
                        : "color-mix(in srgb, var(--accent) 35%, transparent)"
                    }
                    strokeDasharray="1.4 1.6"
                    strokeWidth="0.25"
                    opacity={signal.isSubmitted ? 0.65 : 0.4}
                  />
                );
              })}
            </svg>

            {contributorSignals.map((signal) => (
              <React.Fragment key={signal.contributor.id}>
                <div
                  className="absolute top-1/2 left-1/2"
                  style={{
                    transform: `translate(calc(-50% + ${signal.x}px), calc(-50% + ${signal.y}px))`,
                  }}
                >
                  <motion.div
                    className="border-border bg-surface relative flex w-24 flex-col items-center rounded-[var(--radius-lg)] border px-3 py-3 text-center shadow-[var(--shadow-sm)]"
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: signal.pulseDelay,
                    }}
                  >
                    <div className="border-border bg-surface-muted relative flex h-10 w-10 items-center justify-center rounded-full border">
                      <span className="text-foreground text-sm font-semibold">
                        {initials(signal.contributor.name)}
                      </span>
                      <motion.span
                        className={`border-surface absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 ${
                          signal.isSubmitted
                            ? "bg-[color:var(--status-success)]"
                            : signal.isRegistered
                              ? "bg-[color:var(--accent)]"
                              : "bg-[color:var(--status-idle)]"
                        }`}
                        animate={{
                          scale: [0.9, 1.15, 0.9],
                          opacity: [0.55, 1, 0.55],
                        }}
                        transition={{
                          duration: 1.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: signal.pulseDelay,
                        }}
                      />
                    </div>
                    <p className="text-foreground mt-2 truncate text-xs font-medium tracking-tight">
                      {signal.contributor.name}
                    </p>
                    <p className="text-foreground-subtle mt-0.5 text-[10px] tracking-wide uppercase">
                      {signal.label}
                    </p>
                  </motion.div>
                </div>

                <motion.span
                  className="bg-accent shadow-accent/30 absolute top-1/2 left-1/2 h-2 w-2 rounded-full shadow-[0_0_14px]"
                  animate={{
                    x: [signal.x, signal.x * 0.42, 0],
                    y: [signal.y, signal.y * 0.42, 0],
                    opacity: [0, 1, 0],
                    scale: [0.7, 1.15, 0.7],
                  }}
                  transition={{
                    duration: signal.isSubmitted ? 1.8 : 2.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: signal.pulseDelay,
                  }}
                  style={{ marginLeft: "-4px", marginTop: "-4px" }}
                />
              </React.Fragment>
            ))}

            <motion.div
              className="bg-accent text-accent-foreground border-accent/30 relative z-10 flex h-36 w-36 flex-col items-center justify-center rounded-full border text-center shadow-[var(--shadow-lg)]"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <BrainCircuit className="h-7 w-7" />
              <p className="mt-2 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-80">
                Shared model
              </p>
              <p className="mt-1 max-w-[6.5rem] text-xs leading-snug font-medium tracking-tight">
                Aggregating every encrypted contribution
              </p>
            </motion.div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Encrypted feeds",
                value: `${contributors.filter((entry) => entry.ffePublicKey).length}/${contributors.length}`,
              },
              {
                label: "Committed on-chain",
                value: sessionStatus
                  ? `${sessionStatus.submittedCount}/${sessionStatus.quorum}`
                  : "Syncing",
              },
              {
                label: "Current checkpoint",
                value: runtimeLogs[0]?.phase ?? "training",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border-border bg-surface rounded-[var(--radius-md)] border px-3 py-3"
              >
                <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
                  {stat.label}
                </p>
                <p className="text-foreground mt-1.5 text-sm font-medium tracking-tight">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="text-foreground-muted mt-4 flex items-center gap-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--trust)]" />
            Every stream above is encrypted before it feeds the same live fine-tuning job.
          </div>
        </div>

        <div className="grid content-start gap-3">
          {[
            { label: "FFE session", value: `#${project.chainSession?.sessionId ?? "—"}` },
            {
              label: "Base model",
              value: project.chainSession?.baseModel ?? "Awaiting sync",
            },
            {
              label: "On-chain quorum",
              value: sessionStatus
                ? `${sessionStatus.submittedCount}/${sessionStatus.quorum} submitted`
                : "Telemetry refreshing",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-border bg-surface-muted/40 rounded-[var(--radius-md)] border px-4 py-3"
            >
              <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
                {stat.label}
              </p>
              <p className="text-foreground mt-1.5 text-sm font-medium tracking-tight">
                {stat.value}
              </p>
            </div>
          ))}

          <div className="border-border bg-surface rounded-[var(--radius-lg)] border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
                Live training log
              </p>
              <Badge tone="info">{runtimeLogs.length} updates</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {runtimeLogs.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <motion.span
                      className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${
                        toneDotClasses[entry.tone ?? "info"] ?? toneDotClasses.info
                      }`}
                      animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.55, 1, 0.55] }}
                      transition={{
                        duration: 1.7,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.08,
                      }}
                    />
                    {index < runtimeLogs.length - 1 && (
                      <div className="border-border mt-2 h-full w-px border-l" />
                    )}
                  </div>
                  <div className="border-border bg-surface-muted/40 min-w-0 rounded-[var(--radius-md)] border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase ${
                          toneClasses[entry.tone ?? "info"] ?? toneClasses.info
                        }`}
                      >
                        {entry.phase ?? "update"}
                      </span>
                      <span className="text-foreground-subtle text-[10px]">
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-foreground mt-1.5 text-sm leading-relaxed">
                      {entry.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-foreground-muted mt-4 text-xs leading-relaxed">
              We surface the real backend milestones here, including training, trained, delivering,
              delivered, acknowledged, and any failure state.
            </p>
          </div>

          <div className="border-border bg-surface-muted/40 rounded-[var(--radius-md)] border px-4 py-3">
            <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
              Latest checkpoint
            </p>
            <p className="text-foreground mt-1.5 text-sm font-medium tracking-tight">
              {latestMessage}
            </p>
            <div className="mt-4 grid gap-2">
              {[0, 1, 2].map((bar) => (
                <div
                  key={bar}
                  className="bg-surface h-1.5 overflow-hidden rounded-full border border-[color:var(--border)]"
                >
                  <motion.div
                    className="bg-accent h-full rounded-full"
                    animate={{ x: ["-30%", "105%"] }}
                    transition={{
                      duration: 2.2 + bar * 0.24,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: bar * 0.14,
                    }}
                    style={{ width: `${38 + bar * 12}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FailedTrainingShowcase({
  project,
  sessionStatus,
}: {
  project: Project;
  sessionStatus: FfeSessionStatusResult | null;
}) {
  const diagnostics = [
    `Session #${project.chainSession?.sessionId ?? "—"} reached quorum and entered training.`,
    "The aggregator completed the live run but failed while fetching or sealing the delivered LoRA artifact.",
    "Your uploaded data remains recorded on-chain, but the trained model has not been finalized yet.",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="border-border bg-surface text-foreground relative mt-5 overflow-hidden rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-md)]"
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--status-warning),transparent)]"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border-border bg-surface-muted/40 rounded-[var(--radius-lg)] border p-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--status-warning-bg)]"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <AlertCircle className="h-5 w-5 text-[color:var(--status-warning)]" />
            </motion.div>
            <div>
              <Badge tone="warning">Training interrupted</Badge>
              <h3 className="text-foreground mt-2 text-lg font-medium tracking-tight">
                The model run needs attention before delivery can finish.
              </h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {diagnostics.map((line, index) => (
              <div key={line} className="flex items-start gap-3">
                <motion.span
                  className="mt-1.5 inline-flex h-2 w-2 rounded-full bg-[color:var(--status-warning)]"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.12 }}
                />
                <p className="text-foreground-muted text-sm leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="border-border bg-surface-muted/40 rounded-[var(--radius-md)] border px-4 py-3">
            <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
              Latest backend status
            </p>
            <p className="text-foreground mt-1.5 text-sm font-medium tracking-tight">
              {sessionStatus?.failureReason ?? "The aggregator reported a delivery failure."}
            </p>
          </div>
          <div className="border-border bg-surface-muted/40 rounded-[var(--radius-md)] border px-4 py-3">
            <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
              What this means
            </p>
            <p className="text-foreground-muted mt-1.5 text-sm leading-relaxed">
              The UI is now showing the real backend state. This run will not move to Ready until
              the artifact download and final mint handoff complete cleanly.
            </p>
          </div>
          {sessionStatus?.runtimeUpdatedAt && (
            <div className="border-border bg-surface-muted/40 rounded-[var(--radius-md)] border px-4 py-3">
              <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
                Last update
              </p>
              <p className="text-foreground mt-1.5 text-sm font-medium tracking-tight">
                {new Date(sessionStatus.runtimeUpdatedAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { wallets } = useWallets();
  const [project, setProject] = React.useState<Project | null>(null);
  const [sessionStatus, setSessionStatus] = React.useState<FfeSessionStatusResult | null>(null);
  const [startBusy, setStartBusy] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);

  usePageTitle(project?.name ?? "Project");

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    let cancelled = false;

    async function refreshSessionStatus(sessionId: string) {
      return getFfeSessionStatus(sessionId)
        .then((status) => {
          if (cancelled) return;
          const latest = projectStore.get(id);
          // Owner cancellation is optimistic: keep the failed stage even if
          // the aggregator hasn't yet written its failure status to disk.
          const localFailedSticky =
            latest?.stage === "failed" && status.stage !== "failed" && status.stage !== "ready";
          setSessionStatus(
            localFailedSticky
              ? {
                  ...status,
                  stage: "failed",
                  failureReason: status.failureReason ?? "Cancelled by owner.",
                }
              : status,
          );
          if (!latest) return;
          if (latest.stage === "ready" && status.stage !== "failed") return;
          if (localFailedSticky) return;
          const updated = projectStore.update(id, { stage: status.stage });
          if (updated) {
            setProject(updated);
            void updateProject(id, { stage: status.stage }).catch(() => undefined);
          }
        })
        .catch(() => {
          if (!cancelled) setSessionStatus(null);
        });
    }

    async function loadCurrentProject() {
      await Promise.resolve();
      const p = projectStore.get(id) ?? ensureDemoProject(id);
      // demo polish: seed contributor statuses the first time
      if (
        p.ownerId === "u_demo_owner" &&
        !p.chainSession &&
        p.contributors.every((c) => c.status === "not-started")
      ) {
        seedSampleProgress(p.id);
      }
      const current = projectStore.get(id) ?? null;
      if (cancelled) return;
      setProject(current);
      setSessionStatus(null);

      function mergeRemoteProject(remote: Project) {
        if (cancelled) return;
        const local = projectStore.get(id);
        // Don't let a stale remote roll us back from failed/ready to training.
        if (local?.stage === "failed" && remote.stage !== "failed" && remote.stage !== "ready") {
          setProject({ ...remote, stage: local.stage });
          return;
        }
        if (local?.stage === "ready" && remote.stage !== "failed") {
          setProject({ ...remote, stage: local.stage });
          return;
        }
        setProject(remote);
      }

      loadProject(id).then(mergeRemoteProject).catch(() => undefined);

      if (current?.chainSession) {
        void refreshSessionStatus(current.chainSession.sessionId);
      }

      const refreshInterval = window.setInterval(() => {
        const latest = projectStore.get(id);
        if (latest?.chainSession) {
          void refreshSessionStatus(latest.chainSession.sessionId);
        }
        loadProject(id).then(mergeRemoteProject).catch(() => undefined);
      }, 5000);
      intervalRef = refreshInterval;
    }
    let intervalRef: number | undefined;
    void loadCurrentProject();
    return () => {
      cancelled = true;
      if (intervalRef !== undefined) window.clearInterval(intervalRef);
    };
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
  const isSoloProject = project.contributors.every((contributor) => contributor.role === "owner");

  const me = user ? project.contributors.find((c) => c.id === user.id) : undefined;
  const isBlockingDeploy =
    !!project.chainSession && !!me && project.stage === "waiting" && me.status === "not-started";
  const registeredContributors = project.contributors.filter(
    (contributor) => contributor.walletAddress && contributor.ffePublicKey,
  );
  const invitedContributors = project.contributors.filter(
    (contributor) => contributor.role !== "owner",
  );
  const latestAcceptedInvite = isOwner
    ? project.activityEvents?.find((event) => {
        if (event.type !== "contributor.registered") return false;
        const contributorId =
          typeof event.payload?.contributorId === "string" ? event.payload.contributorId : "";
        const contributor = project.contributors.find((entry) => entry.id === contributorId);
        return contributor?.role === "contributor";
      })
    : undefined;
  const latestAcceptedContributor =
    latestAcceptedInvite && typeof latestAcceptedInvite.payload?.contributorId === "string"
      ? project.contributors.find(
          (entry) => entry.id === latestAcceptedInvite.payload?.contributorId,
        )
      : undefined;

  async function startFfeSession(options?: { redirectToContribute?: boolean }) {
    if (!project || !user) return;
    setStartBusy(true);
    setStartError(null);
    try {
      let contributors = project.contributors;
      const owner = contributors.find((contributor) => contributor.id === project.ownerId);
      const ownerWallet =
        wallets.find(
          (wallet) =>
            wallet.type === "ethereum" &&
            owner?.walletAddress &&
            wallet.address.toLowerCase() === owner.walletAddress.toLowerCase(),
        ) ??
        wallets.find(
          (wallet) =>
            wallet.type === "ethereum" &&
            user.walletAddress &&
            wallet.address.toLowerCase() === user.walletAddress.toLowerCase(),
        ) ??
        wallets.find((wallet) => wallet.type === "ethereum");

      if (!ownerWallet) {
        throw new Error("Connect the owner wallet before starting the finetuning session.");
      }

      if (!owner?.ffePublicKey) {
        const keys = createBrowserFfeKeyPair();
        contributors = contributors.map((contributor) =>
          contributor.id === project.ownerId
            ? {
                ...contributor,
                walletAddress: ownerWallet.address,
                ffePublicKey: keys.publicKey,
                ffePrivateKey: keys.privateKey,
                registeredAt: new Date().toISOString(),
              }
            : contributor,
        );
      }

      const participants = contributors
        .filter((contributor) => contributor.walletAddress && contributor.ffePublicKey)
        .map((contributor) => ({
          contributorId: contributor.id,
          address: contributor.walletAddress!,
          publicKey: contributor.ffePublicKey!,
          privateKey: contributor.ffePrivateKey,
        }));

      if (participants.length === 0) {
        throw new Error("At least one registered wallet is required before starting.");
      }

      const chainSession = await createFfeProjectSession({
        templateId: project.templateId,
        name: project.name,
        goal: project.goal,
        owner: {
          id: user.id,
          name: user.displayName,
          email: user.email,
          walletAddress: ownerWallet.address,
        },
        invitees: project.contributors
          .filter((contributor) => contributor.role !== "owner")
          .map((contributor) => ({ identifier: contributor.email, role: contributor.role })),
        deadline: project.deadline,
        stakeUsd: project.stakeUsd,
        participants,
      });
      const updated = projectStore.update(project.id, {
        contributors,
        chainSession,
        stage: "waiting",
      });
      if (updated) setProject(updated);
      void updateProject(project.id, {
        contributors,
        chainSession,
        stage: "waiting",
      }).catch((err) => console.warn("Could not persist FFE session.", err));
      if (options?.redirectToContribute) {
        router.push(`/p/${project.id}/contribute`);
      }
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Could not start the FFE session.");
    } finally {
      setStartBusy(false);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col">
      {isBlockingDeploy && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="bg-accent text-accent-foreground sticky top-0 z-30 flex items-center justify-center gap-3 px-4 py-2 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>You&apos;re up — the project is waiting on your contribution.</span>
          <Link
            href={`/p/${project.id}/contribute`}
            className="font-medium underline-offset-2 hover:underline"
          >
            Go contribute →
          </Link>
        </motion.div>
      )}
      <header className="border-border mx-auto flex w-full max-w-[96rem] items-center justify-between border-b px-6 py-4">
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
          <div className="flex items-center gap-3">
            <TrustBadge />
            <UserPill />
          </div>{" "}
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 py-10">
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
          const isDraft = !project.chainSession;
          const isWaitingOnYou =
            !isDraft && project.stage === "waiting" && me.status === "not-started";
          const isTrainingStage = project.stage === "training";
          const isFailedStage = project.stage === "failed";
          const isReady = project.stage === "ready";
          const headline = isDraft
            ? isOwner
              ? isSoloProject
                ? "Add your training data."
                : "Collect contributor wallets."
              : me.registeredAt
                ? "You're registered."
                : "Register from the invite link."
            : isTrainingStage
              ? "Training is underway."
              : isFailedStage
                ? "Training needs attention."
              : isWaitingOnYou
                ? "You're up."
                : isReady
                  ? "The new version is ready."
                  : `Status: ${me.status.replace(/-/g, " ")}`;
          const sub = isDraft
            ? isOwner
              ? isSoloProject
                ? "We'll open your private upload room and start the on-chain session in one step."
                : "Share the invite link, then start the on-chain session when enough people are ready."
              : me.registeredAt
                ? "The owner can start finetuning once the team is ready."
                : "Open the invite link to connect your wallet and register your training key."
            : isTrainingStage
              ? "Your encrypted dataset is in the live run. We'll surface the next checkpoint as soon as it clears evaluation."
              : isFailedStage
                ? sessionStatus?.failureReason ??
                  "The backend run stopped before the trained model could be finalized."
              : isWaitingOnYou
                ? "Add your training examples to keep the project moving."
                : isReady
                  ? "Try the new model side-by-side and vote."
                  : "We'll update you when the project changes stage.";
          const ctaHref = isDraft
            ? isSoloProject
              ? `/p/${project.id}/contribute`
              : `/join?code=${project.inviteCode}`
            : isReady
              ? `/p/${project.id}/result`
              : isFailedStage
                ? null
              : `/p/${project.id}/contribute`;
          const ctaLabel = isDraft
            ? isSoloProject
              ? "Add training data"
              : "Open invite"
            : isTrainingStage
              ? "Training live"
              : isFailedStage
                ? "Run needs attention"
              : isReady
                ? "Try the new version"
                : "Go contribute";
          const ctaIcon = isDraft && isSoloProject ? Play : isReady ? Sparkles : Upload;

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
              {isTrainingStage ? (
                <Button disabled variant="secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {ctaLabel}
                </Button>
              ) : isFailedStage ? (
                <Button disabled variant="secondary">
                  <AlertCircle className="h-4 w-4" />
                  {ctaLabel}
                </Button>
              ) : ctaHref ? (
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
              ) : (
                <Button onClick={() => void startFfeSession({ redirectToContribute: true })}>
                  {startBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {React.createElement(ctaIcon, { className: "h-4 w-4" })}
                      {ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </motion.section>
          );
        })()}

        {isOwner && latestAcceptedContributor && latestAcceptedInvite && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="border-border bg-surface mt-4 flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border p-4"
          >
            <div>
              <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
                Invite accepted
              </p>
              <p className="text-foreground mt-1 text-sm font-medium tracking-tight">
                {latestAcceptedContributor.name} connected a wallet and is ready for the session.
              </p>
              <p className="text-foreground-muted mt-1 text-xs">
                Accepted{" "}
                {new Date(latestAcceptedInvite.createdAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <Badge tone="success">Ready</Badge>
          </motion.section>
        )}

        <section className="border-border bg-surface mt-6 rounded-[var(--radius-lg)] border p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium tracking-tight">Progress</h2>
            {isOwner && project.ownerId === "u_demo_owner" && !project.chainSession && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const demoStage = project.stage === "failed" ? "training" : project.stage;
                  const i = PROJECT_STAGES.indexOf(demoStage);
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

          {!project.chainSession && (
            <div className="border-border bg-surface-muted/40 mb-5 rounded-[var(--radius-md)] border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
                    Draft session
                  </p>
                  <p className="text-foreground mt-1 text-sm font-medium">
                    {isSoloProject
                      ? "Your wallet is ready"
                      : `${registeredContributors.length} of ${project.contributors.length} wallets ready`}
                  </p>
                  <p className="text-foreground-muted mt-1 text-xs">
                    {isSoloProject
                      ? "No collaborator window is needed here. Start the on-chain session whenever you're ready."
                      : "Contributors register from the invite link before the on-chain session starts."}
                  </p>
                </div>
                {isOwner && (
                  isSoloProject ? (
                    <Button asChild>
                      <Link href={`/p/${project.id}/contribute`}>
                        <Play className="h-4 w-4" />
                        Add training data
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void startFfeSession({ redirectToContribute: false })}
                      disabled={startBusy}
                    >
                      {startBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Start session
                        </>
                      )}
                    </Button>
                  )
                )}
              </div>
              {invitedContributors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.contributors.map((contributor) => (
                    <Badge
                      key={contributor.id}
                      tone={contributor.registeredAt ? "success" : "neutral"}
                      outline={!contributor.registeredAt}
                    >
                      {contributor.name}
                      {contributor.registeredAt ? " ready" : " pending"}
                    </Badge>
                  ))}
                </div>
              )}
              {startError && <p className="text-status-danger mt-3 text-xs">{startError}</p>}
            </div>
          )}

          <ProgressBar
            stage={project.stage === "failed" ? "training" : project.stage}
            stageLabels={isSoloProject ? { waiting: "Prepare your data" } : undefined}
          />

          {project.stage === "training" && (
            <TrainingShowcase
              project={project}
              sessionStatus={sessionStatus}
              isOwner={isOwner}
              onCancelled={(reason) => {
                const updated = projectStore.update(project.id, { stage: "failed" });
                if (updated) setProject(updated);
                setSessionStatus((prev) =>
                  prev ? { ...prev, stage: "failed", failureReason: reason } : prev,
                );
                void updateProject(project.id, { stage: "failed" }).catch(() => undefined);
              }}
            />
          )}

          {project.stage === "failed" && (
            <FailedTrainingShowcase project={project} sessionStatus={sessionStatus} />
          )}

          {project.chainSession && project.stage !== "training" && project.stage !== "failed" && (
            <div className="border-border bg-surface-muted/40 mt-5 grid gap-3 rounded-[var(--radius-md)] border p-4 text-xs sm:grid-cols-4">
              <div>
                <p className="text-foreground-subtle tracking-widest uppercase">FFE session</p>
                <p className="text-foreground mt-1 font-mono">#{project.chainSession.sessionId}</p>
              </div>
              <div>
                <p className="text-foreground-subtle tracking-widest uppercase">Base model</p>
                <p className="text-foreground mt-1 truncate">{project.chainSession.baseModel}</p>
              </div>
              <div>
                <p className="text-foreground-subtle tracking-widest uppercase">Mode</p>
                <p className="text-foreground mt-1">
                  {project.chainSession.mode === "wallet-owner"
                    ? "Wallet-owned submit"
                    : "Live server bridge"}
                </p>
              </div>
              {sessionStatus && (
                <div>
                  <p className="text-foreground-subtle tracking-widest uppercase">On-chain</p>
                  <p className="text-foreground mt-1">
                    {sessionStatus.submittedCount}/{sessionStatus.quorum} submitted
                  </p>
                </div>
              )}
            </div>
          )}

          {(() => {
            const uploaded = project.contributors.filter((c) => c.status !== "not-started").length;
            const total = project.contributors.length;
            const mustPassSet = project.mustPass.length >= 3;
            const items: Array<{
              ok: boolean;
              warn: boolean;
              label: string;
              href?: string;
            }> = [
              {
                ok: uploaded === total,
                warn: uploaded > 0 && uploaded < total,
                label: isSoloProject
                  ? uploaded === 0
                    ? "Your upload has not started"
                    : uploaded === total
                      ? "Your upload is ready"
                      : `Upload progress: ${uploaded} of ${total}`
                  : `${uploaded} of ${total} contributors uploaded`,
              },
              {
                ok: mustPassSet,
                warn: false,
                label: mustPassSet ? "Must-Pass Scenarios set" : "Must-Pass Scenarios not yet set",
                href: isOwner ? `/p/${project.id}/scenarios` : undefined,
              },
            ];
            if (!isSoloProject) {
              const daysLeft = Math.max(
                0,
                Math.round(
                  (new Date(project.deadline + "T23:59:59").getTime() -
                    new Date(project.createdAt).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              );
              items.push({
                ok: daysLeft > 1,
                warn: daysLeft <= 1,
                label:
                  daysLeft === 0
                    ? "Deadline is today"
                    : daysLeft === 1
                      ? "Deadline is tomorrow"
                      : `Deadline in ${daysLeft} days`,
              });
            }
            return (
              <ul
                className={`border-border mt-6 grid gap-2 border-t pt-5 text-sm ${
                  isSoloProject ? "sm:grid-cols-2" : "sm:grid-cols-3"
                }`}
              >
                {items.map((it, i) => {
                  const Icon = it.ok ? Check : it.warn ? AlertCircle : Circle;
                  const toneClass = it.ok
                    ? "text-foreground"
                    : it.warn
                      ? "text-status-warning"
                      : "text-foreground-subtle";
                  const content = (
                    <>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-xs tracking-tight">{it.label}</span>
                    </>
                  );
                  return (
                    <li key={i} className={`flex items-center gap-2 ${toneClass}`}>
                      {it.href ? (
                        <Link
                          href={it.href}
                          className="hover:text-foreground inline-flex items-center gap-2 underline-offset-4 hover:underline"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
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
              {isSoloProject ? "Trainer" : "Contributors"}
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
              const isDraftRegistered =
                !project.chainSession && isContributorRegistered(project, c.id);
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
                  {isDraftRegistered ? (
                    <Badge tone="success">Ready</Badge>
                  ) : !project.chainSession ? (
                    <Badge tone="neutral" outline>
                      Pending
                    </Badge>
                  ) : (
                    <StatusChip status={c.status} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </section>
    </main>
  );
}
