"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X } from "lucide-react";
import { WizardShell, type WizardStep } from "@/components/wizard/WizardShell";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getTemplate } from "@/lib/mock/templates";
import type { Role } from "@/lib/mock/types";

interface Invitee {
  id: string;
  identifier: string; // email or wallet address
  role: Role;
}

interface WizardState {
  goal: string;
  invitees: Invitee[];
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
  const router = useRouter();
  const params = useSearchParams();
  const templateId = params.get("template") ?? "customer-support";
  const template = getTemplate(templateId);

  const [state, setState] = React.useState<WizardState>({
    goal: template?.goal ?? "",
    invitees: [newInvitee()],
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
  ];

  function handleNext() {
    if (index < steps.length - 1) {
      setIndex((i) => i + 1);
    } else {
      router.push("/p/p_demo");
    }
  }

  return (
    <WizardShell
      steps={steps}
      currentIndex={index}
      onPrev={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={handleNext}
      onCancel={() => router.push("/new")}
    />
  );
}
