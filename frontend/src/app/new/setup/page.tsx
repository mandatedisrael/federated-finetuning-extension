"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Plus, X, Calendar } from "lucide-react";
import { WizardShell, type WizardStep } from "@/components/wizard/WizardShell";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getTemplate } from "@/lib/mock/templates";
import { projectStore } from "@/lib/mock/projectStore";
import { useAuth } from "@/lib/auth/AuthProvider";
import { sendProjectInvites } from "@/lib/notify/inviteDelivery";
import { saveProject, updateProject } from "@/lib/projects/client";
import type { Role } from "@/lib/mock/types";

interface Invitee {
  id: string;
  identifier: string; // email or wallet address
  role: Role;
}

interface WizardState {
  goal: string;
  invitees: Invitee[];
  deadline: string; // YYYY-MM-DD
  stakeUsd: number;
  showAdvancedStake: boolean;
}

const DEFAULT_STAKE_USD = 5;

const DEFAULT_DAYS_OUT = 7;

function isoNDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function humanizeDelta(iso: string): string {
  if (!iso) return "";
  const target = new Date(iso + "T23:59:59");
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return "in the past";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ~${Math.round(days / 7)} weeks`;
  return `in ~${Math.round(days / 30)} months`;
}

function newInvitee(): Invitee {
  return {
    id: Math.random().toString(36).slice(2, 9),
    identifier: "",
    role: "contributor",
  };
}

function isValidIdentifier(v: string) {
  const s = v.trim();
  if (!s) return false;
  if (s.includes("@") && s.includes(".")) return true;
  if (/^0x[a-fA-F0-9]{6,}$/.test(s)) return true;
  return false;
}

export default function SetupWizardPage() {
  return (
    <React.Suspense fallback={null}>
      <SetupWizardInner />
    </React.Suspense>
  );
}

function SetupWizardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const templateId = params.get("template") ?? "customer-support";
  const template = getTemplate(templateId);
  const [creating, setCreating] = React.useState(false);
  const [creationError, setCreationError] = React.useState<string | null>(null);

  const [state, setState] = React.useState<WizardState>({
    goal: template?.goal ?? "",
    invitees: [newInvitee()],
    deadline: isoNDaysFromNow(DEFAULT_DAYS_OUT),
    stakeUsd: DEFAULT_STAKE_USD,
    showAdvancedStake: false,
  });
  const [index, setIndex] = React.useState(0);

  const validInvitees = state.invitees.filter((i) => isValidIdentifier(i.identifier));

  const steps: WizardStep[] = [
    {
      id: "goal",
      label: "Goal",
      isValid: () => state.goal.trim().length >= 8,
      render: () => (
        <div className="space-y-6">
          <div>
            {template && (
              <Badge tone="accent" outline className="mb-4">
                {template.name}
              </Badge>
            )}
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
              What should the AI get better at?
            </h1>
            <p className="text-foreground-muted mt-3 text-base leading-relaxed">
              Write it as a plain sentence. Your contributors will see this — keep it specific
              enough that everyone agrees on what &quot;good&quot; means.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal">Goal</Label>
            <Textarea
              id="goal"
              rows={4}
              autoFocus
              value={state.goal}
              onChange={(e) => setState((s) => ({ ...s, goal: e.target.value }))}
              placeholder="e.g. Answer customer questions in our voice, with our refund policy."
            />
            <p className="text-foreground-subtle text-xs">
              Tip: start with &quot;Answer…&quot;, &quot;Summarize…&quot;, or &quot;Reply
              like…&quot;.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "invite",
      label: "Invite",
      isValid: () => validInvitees.length >= 1,
      render: () => (
        <div className="space-y-6">
          <div>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Who&apos;s helping?</h1>
            <p className="text-foreground-muted mt-3 text-base leading-relaxed">
              Add the people you&apos;d like to contribute training examples. They can join with
              email, Google, or a wallet — whichever is easier.
            </p>
          </div>

          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {state.invitees.map((inv) => (
                <motion.div
                  key={inv.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={inv.identifier}
                    placeholder="alice@team.com or 0x…"
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        invitees: s.invitees.map((i) =>
                          i.id === inv.id ? { ...i, identifier: e.target.value } : i,
                        ),
                      }))
                    }
                  />
                  <select
                    value={inv.role}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        invitees: s.invitees.map((i) =>
                          i.id === inv.id ? { ...i, role: e.target.value as Role } : i,
                        ),
                      }))
                    }
                    className="border-border bg-surface text-foreground hover:border-border-strong focus:border-accent focus:ring-accent/15 h-10 rounded-[var(--radius-md)] border px-2 text-sm focus:ring-2 focus:outline-none"
                  >
                    <option value="contributor">Contributor</option>
                    <option value="owner">Co-owner</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove invitee"
                    disabled={state.invitees.length <= 1}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        invitees: s.invitees.filter((i) => i.id !== inv.id),
                      }))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setState((s) => ({ ...s, invitees: [...s.invitees, newInvitee()] }))}
            >
              <Plus className="h-4 w-4" />
              Add another
            </Button>
          </div>

          <p className="text-foreground-subtle text-xs">
            {validInvitees.length} ready · {state.invitees.length - validInvitees.length} pending —
            emails and wallets are both fine.
          </p>
        </div>
      ),
    },
    {
      id: "deadline",
      label: "Deadline",
      isValid: () =>
        Boolean(state.deadline) && new Date(state.deadline) > new Date(Date.now() - 86_400_000),
      render: () => (
        <div className="space-y-6">
          <div>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
              When do contributions close?
            </h1>
            <p className="text-foreground-muted mt-3 text-base leading-relaxed">
              After the deadline, the project moves into training automatically. You can extend it
              later if contributors need more time.
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="deadline">Deadline</Label>
            <div className="relative">
              <Calendar className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="deadline"
                type="date"
                className="pl-9"
                value={state.deadline}
                min={isoNDaysFromNow(1)}
                onChange={(e) => setState((s) => ({ ...s, deadline: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[3, 7, 14, 30].map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setState((s) => ({ ...s, deadline: isoNDaysFromNow(d) }))}
                >
                  +{d} days
                </Button>
              ))}
            </div>
            {state.deadline && (
              <p className="text-foreground-subtle text-xs">
                Closes {humanizeDelta(state.deadline)} · {state.deadline}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "stake",
      label: "Deposit",
      isValid: () => state.stakeUsd >= 0,
      render: () => (
        <div className="space-y-6">
          <div>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
              A small refundable deposit.
            </h1>
            <p className="text-foreground-muted mt-3 text-base leading-relaxed">
              Each contributor puts down a deposit when they submit. It&apos;s fully refunded as
              soon as their contribution passes the data-quality check. This keeps spam out and
              treats first-time mistakes kindly.
            </p>
          </div>

          <div className="border-border bg-surface rounded-[var(--radius-lg)] border p-5">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-4xl tracking-tight">${state.stakeUsd}</span>
              <span className="text-foreground-muted text-sm">per contributor · refundable</span>
            </div>
            <p className="text-foreground-subtle mt-2 text-xs">
              Held in the project escrow. Returned automatically on a passing contribution.
            </p>

            <button
              type="button"
              className="text-accent mt-4 inline-flex items-center text-xs underline-offset-4 hover:underline"
              onClick={() => setState((s) => ({ ...s, showAdvancedStake: !s.showAdvancedStake }))}
            >
              {state.showAdvancedStake ? "Hide advanced" : "Advanced — change amount"}
            </button>

            {state.showAdvancedStake && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.2 }}
                className="mt-4 space-y-2 overflow-hidden"
              >
                <Label htmlFor="stake">Deposit amount (USD)</Label>
                <Input
                  id="stake"
                  type="number"
                  min={0}
                  max={500}
                  value={state.stakeUsd}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      stakeUsd: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
                <p className="text-foreground-subtle text-xs">
                  Most projects sit at $5–$25. Higher amounts deter spam but raise the bar for
                  participation.
                </p>
              </motion.div>
            )}
          </div>

          {creationError && (
            <div className="border-status-danger/20 text-status-danger flex items-start gap-2 rounded-[var(--radius-md)] border bg-[var(--status-danger-bg)] p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{creationError}</p>
            </div>
          )}
        </div>
      ),
    },
  ];

  async function handleFinish() {
    if (!user) {
      router.push("/");
      return;
    }
    setCreating(true);
    setCreationError(null);

    try {
      const invitees = validInvitees.map((i) => ({
        identifier: i.identifier.trim(),
        role: i.role,
      }));
      const project = projectStore.create({
        templateId,
        name: template?.name ?? "Untitled project",
        goal: state.goal.trim(),
        ownerId: user.id,
        ownerName: user.displayName,
        ownerEmail: user.email,
        ownerWalletAddress: user.walletAddress || undefined,
        invitees,
        deadline: state.deadline,
        stakeUsd: state.stakeUsd,
      });
      await saveProject(project).catch((err) => {
        console.warn("Could not persist project draft to Supabase.", err);
        return project;
      });
      const emailRecipients = project.contributors
        .filter((contributor) => contributor.role !== "owner" && contributor.email.includes("@"))
        .map((contributor) => ({ email: contributor.email, name: contributor.name }));
      if (emailRecipients.length > 0) {
        const delivery = await sendProjectInvites({
          projectId: project.id,
          projectName: project.name,
          ownerName: user.displayName,
          origin: window.location.origin,
          inviteCode: project.inviteCode,
          deadline: project.deadline,
          recipients: emailRecipients,
        });
        projectStore.update(project.id, { inviteDeliveries: delivery.deliveries });
        await updateProject(project.id, { inviteDeliveries: delivery.deliveries }).catch((err) => {
          console.warn("Could not persist invite delivery status.", err);
        });
      }
      router.push(`/new/done?id=${project.id}`);
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : "Could not create the draft project.");
      setCreating(false);
    }
  }

  function handleNext() {
    if (index < steps.length - 1) {
      setIndex((i) => i + 1);
    } else {
      void handleFinish();
    }
  }

  return (
    <WizardShell
      steps={steps}
      currentIndex={index}
      onPrev={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={handleNext}
      onCancel={() => router.push("/new")}
      busy={creating}
      finishLabel={creating ? "Creating draft…" : "Create draft"}
    />
  );
}
