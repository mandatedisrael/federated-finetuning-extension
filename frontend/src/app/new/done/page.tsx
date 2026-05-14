"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Check, Copy, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { AvatarStack } from "@/components/domain/AvatarStack";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { UserPill } from "@/components/auth/UserPill";
import { projectStore } from "@/lib/mock/projectStore";
import type { Project } from "@/lib/mock/types";

export default function ProjectCreatedPage() {
  return (
    <React.Suspense fallback={null}>
      <ProjectCreatedInner />
    </React.Suspense>
  );
}

function ProjectCreatedInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const [project, setProject] = React.useState<Project | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
    if (!id) {
      router.replace("/new");
      return;
    }
    const p = projectStore.get(id);
    if (!p) {
      router.replace("/new");
      return;
    }
    setProject(p);
  }, [id, router]);

  if (!project) return null;

  const inviteUrl = `${origin}/join?code=${project.inviteCode}`;
  const invitees = project.contributors.filter((c) => c.role !== "owner");

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          FFE<span className="text-foreground-subtle">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <TrustBadge />
          <UserPill />
        </div>{" "}
      </header>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="bg-trust/15 text-trust mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full"
        >
          <Check className="h-7 w-7" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
            Project created
          </p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            Share this with your contributors.
          </h1>
          <p className="text-foreground-muted mt-3 text-base leading-relaxed">
            Anyone with this link can join. They&apos;ll sign in with email or Google — no wallet
            setup required on their side either.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.32 }}
          className="mt-8 space-y-3"
        >
          <Card className="overflow-hidden">
            <CardContent className="flex items-center gap-2 p-3">
              <code className="text-foreground-muted flex-1 truncate font-mono text-xs sm:text-sm">
                {inviteUrl}
              </code>
              <Button onClick={copy} variant={copied ? "secondary" : "primary"} size="sm">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </CardContent>
          </Card>

          {invitees.length > 0 && (
            <div className="border-border bg-surface-muted/40 flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed p-3">
              <AvatarStack size="sm" people={invitees.map((c) => ({ id: c.id, name: c.name }))} />
              <p className="text-foreground-muted text-xs">
                We&apos;ll send a magic-link email to {invitees.length}{" "}
                {invitees.length === 1 ? "person" : "people"} you added.
              </p>
              <Button variant="ghost" size="sm" className="ml-auto" disabled>
                <Mail className="h-3.5 w-3.5" />
                Sent
              </Button>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="mt-10 flex items-center justify-between"
        >
          <p className="text-foreground-subtle text-xs">
            Deadline: {project.deadline} · Deposit: ${project.stakeUsd} per contributor
            {project.chainSession ? ` · FFE session #${project.chainSession.sessionId}` : ""}
          </p>
          <Button asChild>
            <Link href={`/p/${project.id}`}>
              Open project <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </section>
    </main>
  );
}
