"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, AlertCircle, ShieldCheck, RefreshCcw, Pencil, ArrowRight } from "lucide-react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mockRejectionReport, type RejectionReason } from "@/lib/mock/rejection";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject } from "@/lib/mock/seedDemo";
import type { Project } from "@/lib/mock/types";

export default function RejectionPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = React.useState<Project | null>(null);
  const report = React.useMemo(() => mockRejectionReport(), []);

  React.useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    async function loadProject() {
      await Promise.resolve();
      if (!cancelled) {
        setProject(projectStore.get(params.id) ?? ensureDemoProject(params.id));
      }
    }
    void loadProject();
    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href={`/p/${project.id}`}
          className="text-foreground-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
        <TrustBadge variant="active" />
      </header>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="space-y-6"
      >
        <div className="border-status-warning/30 flex items-start gap-3 rounded-[var(--radius-lg)] border bg-[var(--status-warning-bg)] p-5">
          <span className="bg-status-warning/15 text-status-warning mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <AlertCircle className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-serif text-3xl tracking-tight">
              Some of your examples need attention.
            </h1>
            <p className="text-foreground-muted mt-1.5 text-sm leading-relaxed">
              We reviewed the {report.submittedCount} examples you submitted and{" "}
              <span className="text-foreground font-medium">
                {report.rejectedCount} need a small fix
              </span>{" "}
              before they can be included in training. Your private data never left your machine
              unencrypted — only the quality gate saw a summary.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-foreground-subtle px-1 text-xs tracking-widest uppercase">
            What needs attention
          </div>
          {report.reasons.map((reason) => (
            <ReasonRow key={reason.id} reason={reason} projectId={project.id} />
          ))}
        </div>

        <DepositPanel project={project} />
      </motion.div>
    </main>
  );
}

function DepositPanel({ project }: { project: Project }) {
  const deadline = new Date(project.deadline).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <div className="border-trust/20 rounded-[var(--radius-lg)] border bg-[var(--trust-bg)]/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="bg-trust/10 text-trust mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-foreground text-sm font-medium tracking-tight">
                Deposits are not active in this release.
              </h3>
              <Badge outline>Planned</Badge>
            </div>
            <p className="text-foreground-muted mt-1 text-sm leading-relaxed">
              First rejections still do not count against you. Resubmit a fixed version by{" "}
              <span className="text-foreground font-medium">{deadline}</span> and we&apos;ll keep
              the flow moving without any escrow step.
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link href={`/p/${project.id}/contribute`}>
            <RefreshCcw className="h-4 w-4" />
            Resubmit with changes
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ReasonRow({ reason, projectId }: { reason: RejectionReason; projectId: string }) {
  return (
    <div className="border-border bg-surface rounded-[var(--radius-lg)] border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-medium tracking-tight">{reason.title}</h3>
          <p className="text-foreground-muted mt-1 text-sm leading-relaxed">{reason.detail}</p>
        </div>
        <Badge tone="warning" outline className="shrink-0">
          {reason.affectedCount}
        </Badge>
      </div>

      {reason.fix === "rewrite" && (
        <div className="border-border/60 mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-foreground-subtle text-xs leading-relaxed">
            Skip another conversion — write these {reason.affectedCount} examples by hand in the
            Rewrite Studio. Usually faster than re-uploading.
          </p>
          <Button asChild variant="secondary" size="sm" className="shrink-0">
            <Link href={`/p/${projectId}/contribute?tab=rewrite`}>
              <Pencil className="h-3.5 w-3.5" />
              Switch to Rewrite Studio
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
