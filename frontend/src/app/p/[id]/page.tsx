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
  Waves,
  ShieldCheck,
  Orbit,
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

function TrainingShowcase({
  project,
  sessionStatus,
}: {
  project: Project;
  sessionStatus: FfeSessionStatusResult | null;
}) {
  const telemetry = [
    {
      label: "Dataset alignment",
      detail: "Normalizing uploaded examples into the active fine-tuning window.",
      delay: 0,
    },
    {
      label: "Gradient updates",
      detail: "Applying contributor signal against the selected base model.",
      delay: 0.18,
    },
    {
      label: "Validation sweep",
      detail: "Checking model drift and preparing the next checkpoint.",
      delay: 0.36,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="relative mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[#d6ddff] bg-[#0e1530] p-5 text-white shadow-[0_24px_80px_rgba(48,76,255,0.18)]"
    >
      <motion.div
        className="absolute -top-16 right-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.28),transparent_68%)]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.18),transparent_68%)]"
        animate={{ scale: [0.94, 1.06, 0.94], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 5.1, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-white/10 bg-white/10 text-white">Training live</Badge>
            <span className="text-xs tracking-[0.18em] text-white/55 uppercase">Federated run</span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <motion.div
                  className="relative flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                >
                  <motion.div
                    className="absolute inset-1 rounded-full border border-cyan-200/25"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  />
                  <BrainCircuit className="h-6 w-6 text-cyan-100" />
                </motion.div>
                <div>
                  <p className="text-xs tracking-[0.18em] text-white/55 uppercase">Core loop</p>
                  <p className="mt-1 text-lg font-medium tracking-tight">
                    Fine-tuning checkpoint active
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {telemetry.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <motion.span
                      className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.75)]"
                      animate={{ scale: [0.9, 1.25, 0.9], opacity: [0.45, 1, 0.45] }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: item.delay,
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium tracking-tight">{item.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/65">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.18em] text-white/55 uppercase">Training flow</p>
                <Orbit className="h-4 w-4 text-cyan-200/80" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                {[
                  { icon: ShieldCheck, label: "Encrypted data" },
                  { icon: Waves, label: "Gradient pass" },
                  { icon: Sparkles, label: "Checkpoint merge" },
                ].map((node, index) => {
                  const Icon = node.icon;
                  return (
                    <React.Fragment key={node.label}>
                      <motion.div
                        className="flex w-full max-w-[8rem] flex-col items-center rounded-[var(--radius-lg)] border border-white/10 bg-white/6 px-3 py-4 text-center"
                        animate={{ y: [0, -5, 0] }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.24,
                        }}
                      >
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                          <Icon className="h-5 w-5 text-cyan-100" />
                        </div>
                        <p className="mt-3 text-xs font-medium tracking-tight text-white/85">
                          {node.label}
                        </p>
                      </motion.div>
                      {index < 2 && (
                        <motion.div
                          className="hidden h-px flex-1 bg-[linear-gradient(90deg,rgba(103,232,249,0.18),rgba(96,165,250,0.75),rgba(103,232,249,0.18))] md:block"
                          animate={{ opacity: [0.35, 1, 0.35] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3">
          {[
            { label: "FFE session", value: `#${project.chainSession?.sessionId ?? "—"}` },
            { label: "Base model", value: project.chainSession?.baseModel ?? "Awaiting sync" },
            {
              label: "On-chain quorum",
              value: sessionStatus
                ? `${sessionStatus.submittedCount}/${sessionStatus.quorum} submitted`
                : "Telemetry refreshing",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[var(--radius-lg)] border border-white/10 bg-white/6 px-4 py-3"
            >
              <p className="text-[10px] tracking-[0.18em] text-white/55 uppercase">{stat.label}</p>
              <p className="mt-2 text-sm font-medium tracking-tight text-white">{stat.value}</p>
            </div>
          ))}

          <div className="rounded-[var(--radius-lg)] border border-cyan-300/20 bg-cyan-300/8 px-4 py-4">
            <p className="text-[10px] tracking-[0.18em] text-cyan-100/70 uppercase">
              Live activity
            </p>
            <p className="mt-2 text-sm font-medium tracking-tight text-cyan-50">
              The model is processing your uploaded dataset and preparing the next evaluation
              checkpoint.
            </p>
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((bar) => (
                <div key={bar} className="h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#818cf8,#22d3ee)]"
                    animate={{ x: ["-30%", "105%"] }}
                    transition={{
                      duration: 2.6 + bar * 0.35,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: bar * 0.18,
                    }}
                    style={{ width: "45%" }}
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
      className="relative mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[#fed7aa] bg-[#1c1110] p-5 text-white shadow-[0_24px_80px_rgba(249,115,22,0.16)]"
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.9),transparent)]"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/10"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <AlertCircle className="h-5 w-5 text-amber-200" />
            </motion.div>
            <div>
              <Badge className="border-amber-200/10 bg-amber-200/10 text-amber-50">
                Training interrupted
              </Badge>
              <h3 className="mt-2 text-lg font-medium tracking-tight">
                The model run needs attention before delivery can finish.
              </h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {diagnostics.map((line, index) => (
              <div key={line} className="flex items-start gap-3">
                <motion.span
                  className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-amber-300"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.12 }}
                />
                <p className="text-sm leading-relaxed text-white/78">{line}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/6 px-4 py-3">
            <p className="text-[10px] tracking-[0.18em] text-white/55 uppercase">
              Latest backend status
            </p>
            <p className="mt-2 text-sm font-medium tracking-tight text-white">
              {sessionStatus?.failureReason ?? "The aggregator reported a delivery failure."}
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/6 px-4 py-3">
            <p className="text-[10px] tracking-[0.18em] text-white/55 uppercase">What this means</p>
            <p className="mt-2 text-sm leading-relaxed text-white/72">
              The UI is now showing the real backend state. This run will not move to Ready until
              the artifact download and final mint handoff complete cleanly.
            </p>
          </div>
          {sessionStatus?.runtimeUpdatedAt && (
            <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/6 px-4 py-3">
              <p className="text-[10px] tracking-[0.18em] text-white/55 uppercase">
                Last update
              </p>
              <p className="mt-2 text-sm font-medium tracking-tight text-white">
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
            if (!latest || (latest.stage === "ready" && status.stage !== "failed")) return;
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
              ? null
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
                  <Button
                    onClick={() => void startFfeSession({ redirectToContribute: isSoloProject })}
                    disabled={startBusy}
                  >
                    {startBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        {isSoloProject ? "Add training data" : "Start session"}
                      </>
                    )}
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
            stage={project.stage === "failed" ? "training" : project.stage}
            stageLabels={isSoloProject ? { waiting: "Prepare your data" } : undefined}
          />

          {project.stage === "training" && (
            <TrainingShowcase project={project} sessionStatus={sessionStatus} />
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
