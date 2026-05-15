"use client";

import * as React from "react";
import { useWallets } from "@privy-io/react-auth";
import { useParams } from "next/navigation";
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
import { usePageTitle } from "@/lib/a11y/usePageTitle";
import { createFfeProjectSession, getFfeSessionStatus } from "@/lib/ffe/client";
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

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
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

      loadProject(id)
        .then((remote) => {
          if (!cancelled) setProject(remote);
        })
        .catch(() => undefined);

      if (current?.chainSession) {
        getFfeSessionStatus(current.chainSession.sessionId)
          .then((status) => {
            if (cancelled) return;
            setSessionStatus(status);
            const latest = projectStore.get(id);
            if (!latest || latest.stage === "ready") return;
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
    }
    void loadCurrentProject();
    const refreshInterval = window.setInterval(() => {
      loadProject(id)
        .then((remote) => {
          if (!cancelled) setProject(remote);
        })
        .catch(() => undefined);
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
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

  async function startFfeSession() {
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
      <header className="border-border mx-auto flex w-full max-w-7xl items-center justify-between border-b px-6 py-4">
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
          const isDraft = !project.chainSession;
          const isWaitingOnYou =
            !isDraft && project.stage === "waiting" && me.status === "not-started";
          const isReady = project.stage === "ready";
          const headline = isDraft
            ? isOwner
              ? isSoloProject
                ? "Start your finetuning session."
                : "Collect contributor wallets."
              : me.registeredAt
                ? "You're registered."
                : "Register from the invite link."
            : isWaitingOnYou
              ? "You're up."
              : isReady
                ? "The new version is ready."
                : `Status: ${me.status.replace(/-/g, " ")}`;
          const sub = isDraft
            ? isOwner
              ? isSoloProject
                ? "Your wallet is already connected. Open the session whenever you want to begin uploading data."
                : "Share the invite link, then start the on-chain session when enough people are ready."
              : me.registeredAt
                ? "The owner can start finetuning once the team is ready."
                : "Open the invite link to connect your wallet and register your training key."
            : isWaitingOnYou
              ? "Add your training examples to keep the project moving."
              : isReady
                ? "Try the new model side-by-side and vote."
                : "We'll update you when the project changes stage.";
          const ctaHref = isDraft
            ? isSoloProject
              ? `/p/${project.id}`
              : `/join?code=${project.inviteCode}`
            : isReady
              ? `/p/${project.id}/result`
              : `/p/${project.id}/contribute`;
          const ctaLabel = isDraft
            ? isSoloProject
              ? "Start session"
              : "Open invite"
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
                  <Button onClick={startFfeSession} disabled={startBusy}>
                    {startBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start session
                  </Button>
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
            stage={project.stage}
            stageLabels={isSoloProject ? { waiting: "Prepare your data" } : undefined}
          />

          {project.chainSession && (
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
