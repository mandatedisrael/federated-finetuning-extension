"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WizardShell, type WizardStep } from "@/components/wizard/WizardShell";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { getTemplate } from "@/lib/mock/templates";

interface WizardState {
  goal: string;
}

export default function SetupWizardPage() {
  const router = useRouter();
  const params = useSearchParams();
  const templateId = params.get("template") ?? "customer-support";
  const template = getTemplate(templateId);

  const [state, setState] = React.useState<WizardState>({
    goal: template?.goal ?? "",
  });
  const [index, setIndex] = React.useState(0);

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
  ];

  function handleNext() {
    if (index < steps.length - 1) {
      setIndex((i) => i + 1);
    } else {
      // No further steps yet — placeholder.
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
