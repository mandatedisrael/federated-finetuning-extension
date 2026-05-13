"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Calendar, ShieldCheck, Upload, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { StatusChip } from "@/components/domain/StatusChip";
import { Badge } from "@/components/ui/Badge";
import { UploadZone } from "@/components/contribute/UploadZone";
import { DataConciergeRow } from "@/components/domain/DataConciergeRow";
import { scanFiles, type ConciergeReport } from "@/lib/mock/dataConcierge";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject } from "@/lib/mock/seedDemo";
import type { Project } from "@/lib/mock/types";

export default function ContributePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);

  React.useEffect(() => {
    if (!params?.id) return;
    setProject(projectStore.get(params.id) ?? ensureDemoProject(params.id));
  }, [params?.id]);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading…</p>
      </main>
    );
  }

  const me = user
    ? project.contributors.find((c) => c.id === user.id)
    : project.contributors.find((c) => c.role !== "owner");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href={`/p/${project.id}`}
          className="text-foreground-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
        <TrustBadge variant="active" />
      </header>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="border-border bg-surface flex h-fit w-full shrink-0 flex-col gap-5 rounded-[var(--radius-lg)] border p-5 lg:w-72">
          <div>
            <p className="text-foreground-subtle text-xs tracking-widest uppercase">
              Your contribution
            </p>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">Private Room</h2>
            <p className="text-foreground-muted mt-1 text-xs leading-relaxed">
              Only you can see what&apos;s in here. Examples are encrypted in your browser before
              they leave.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <Row label="Status">
              <StatusChip status={me?.status ?? "not-started"} />
            </Row>
            <Row label="Deposit">
              <Badge tone="trust" outline>
                <ShieldCheck className="h-3 w-3" />${project.stakeUsd} held
              </Badge>
            </Row>
            <Row label="Deadline">
              <span className="text-foreground-muted inline-flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {project.deadline}
              </span>
            </Row>
          </div>
        </aside>

        {/* Main column */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="min-w-0 flex-1"
        >
          <Tabs defaultValue="upload">
            <TabsList>
              <TabsTrigger value="upload">
                <Upload className="h-3.5 w-3.5" />
                Upload files
              </TabsTrigger>
              <TabsTrigger value="rewrite">
                <Pencil className="h-3.5 w-3.5" />
                Rewrite examples
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <UploadFlow projectId={project.id} />
            </TabsContent>

            <TabsContent value="rewrite">
              <div className="border-border bg-surface-muted/40 text-foreground-muted rounded-[var(--radius-lg)] border border-dashed p-10 text-center text-sm">
                Rewrite Studio cards ship next.
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </main>
  );
}

type UploadPhase = "idle" | "scanning" | "review" | "preview";

function UploadFlow({ projectId: _projectId }: { projectId: string }) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [phase, setPhase] = React.useState<UploadPhase>("idle");
  const [report, setReport] = React.useState<ConciergeReport | null>(null);

  async function handleFiles(next: File[]) {
    setFiles(next);
    setPhase("scanning");
    const r = await scanFiles(next);
    setReport(r);
    setPhase("review");
  }

  function reset() {
    setFiles([]);
    setReport(null);
    setPhase("idle");
  }

  if (phase === "idle") {
    return <UploadZone onFiles={handleFiles} />;
  }

  return (
    <div className="space-y-4">
      <div className="border-border bg-surface flex items-center gap-3 rounded-[var(--radius-md)] border p-3">
        <p className="text-foreground-muted flex-1 truncate text-sm">
          {files.length} {files.length === 1 ? "file" : "files"} ·{" "}
          {files.map((f) => f.name).join(", ")}
        </p>
        <button
          type="button"
          className="text-foreground-subtle hover:text-foreground text-xs underline-offset-2 hover:underline"
          onClick={reset}
        >
          Start over
        </button>
      </div>

      {phase === "scanning" && (
        <div className="border-border bg-surface flex items-center gap-3 rounded-[var(--radius-lg)] border p-6">
          <Loader2 className="text-accent h-4 w-4 animate-spin" />
          <p className="text-foreground-muted text-sm">
            Scanning locally for duplicates, formatting, and private info — your files are not
            uploaded yet.
          </p>
        </div>
      )}

      {phase === "review" && report && (
        <div className="space-y-2">
          <div className="text-foreground-subtle px-1 text-xs tracking-widest uppercase">
            Data Concierge
          </div>
          {report.findings.map((f) => (
            <DataConciergeRow
              key={f.id}
              kind={f.kind}
              count={f.count}
              description={f.description}
              actions={f.actions}
              onAction={() => {
                // Mock: no-op for now. Real impl will update report state.
              }}
            />
          ))}
          <div className="border-border bg-surface-muted/40 text-foreground-muted rounded-[var(--radius-lg)] border border-dashed p-10 text-center text-sm">
            Preview table + encrypt-and-submit ship next.
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-foreground-subtle text-xs">{label}</span>
      {children}
    </div>
  );
}
