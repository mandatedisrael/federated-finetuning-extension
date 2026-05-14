"use client";

import * as React from "react";
import { NOTIFY_INTENTS, type NotifyIntent } from "@/lib/notify/deepLinks";
import { renderEmail, type EmailTemplateInput } from "@/lib/notify/emailTemplates";
import { Button } from "@/components/ui/Button";

const SAMPLE: EmailTemplateInput = {
  projectId: "p_demo",
  projectName: "Customer Support Assistant",
  recipientName: "Bob Patel",
  ownerName: "Alice Chen",
  origin: "https://ffe.app",
  inviteCode: "ABC1-23XY",
  deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  versionLabel: "Version 3",
};

const TITLES: Record<NotifyIntent, string> = {
  invite: "Invite",
  "youre-up": "You're up",
  "training-started": "Training started",
  "result-ready": "Result ready",
  "version-published": "Version published",
};

export default function EmailPreviewPage() {
  const [intent, setIntent] = React.useState<NotifyIntent>("invite");
  const [mode, setMode] = React.useState<"html" | "text">("html");
  const email = React.useMemo(() => renderEmail(intent, SAMPLE), [intent]);

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="border-border mx-auto flex w-full max-w-7xl items-center justify-between border-b px-6 py-4">
        <span className="font-serif text-lg tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </span>
        <span className="text-foreground-subtle text-xs tracking-[0.18em] uppercase">
          Email previews
        </span>
      </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {NOTIFY_INTENTS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIntent(i)}
                className={
                  i === intent
                    ? "bg-accent text-accent-foreground rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium"
                    : "border-border text-foreground-muted hover:border-border-strong hover:text-foreground rounded-[var(--radius-pill)] border bg-transparent px-3 py-1.5 text-xs font-medium"
                }
              >
                {TITLES[i]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === "html" ? "primary" : "secondary"}
              onClick={() => setMode("html")}
            >
              HTML
            </Button>
            <Button
              size="sm"
              variant={mode === "text" ? "primary" : "secondary"}
              onClick={() => setMode("text")}
            >
              Text
            </Button>
          </div>
        </div>

        <div className="border-border bg-surface mb-4 grid grid-cols-1 gap-2 rounded-[var(--radius-lg)] border p-4 sm:grid-cols-2">
          <div>
            <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
              Subject
            </p>
            <p className="text-sm">{email.subject}</p>
          </div>
          <div>
            <p className="text-foreground-subtle text-[10px] tracking-wider uppercase">
              Preheader
            </p>
            <p className="text-foreground-muted text-sm">{email.preheader}</p>
          </div>
        </div>

        {mode === "html" ? (
          <iframe
            key={intent}
            title="Email preview"
            srcDoc={email.html}
            className="border-border bg-white h-[820px] w-full rounded-[var(--radius-lg)] border"
            sandbox=""
          />
        ) : (
          <pre className="border-border bg-surface text-foreground overflow-auto rounded-[var(--radius-lg)] border p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {email.text}
          </pre>
        )}
      </section>
    </main>
  );
}
