"use client";

import * as React from "react";
import { useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AlertCircle, ArrowLeft, Calendar, ShieldCheck, Upload, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { UserPill } from "@/components/auth/UserPill";
import { StatusChip } from "@/components/domain/StatusChip";
import { Badge } from "@/components/ui/Badge";
import { UploadZone } from "@/components/contribute/UploadZone";
import { RewriteStudio } from "@/components/contribute/RewriteStudio";
import { DataConciergeRow } from "@/components/domain/DataConciergeRow";
import { scanFiles, type ConciergeReport } from "@/lib/mock/dataConcierge";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SubmitStateMachine, type SubmitPhase } from "@/components/contribute/SubmitStateMachine";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject } from "@/lib/mock/seedDemo";
import { filesToFfePayload, prepareFfeContribution, submitFfeContribution } from "@/lib/ffe/client";
import { submitPreparedContributionWithWallet } from "@/lib/ffe/walletSubmit";
import { loadProject, updateProject } from "@/lib/projects/client";
import type { Project } from "@/lib/mock/types";

export default function ContributePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const initialTab = searchParams?.get("tab") === "rewrite" ? "rewrite" : "upload";

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    let cancelled = false;
    async function loadContributionProject() {
      await Promise.resolve();
      if (!cancelled) setProject(projectStore.get(id) ?? ensureDemoProject(id));
      loadProject(id)
        .then((remote) => {
          if (!cancelled) setProject(remote);
        })
        .catch(() => undefined);
    }
    void loadContributionProject();
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

  const me = user
    ? project.contributors.find((c) => c.id === user.id)
    : project.contributors.find((c) => c.role !== "owner");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href={`/p/${project.id}`}
          className="text-foreground-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
        <div className="flex items-center gap-3">
          <TrustBadge variant="active" />
          <UserPill />
        </div>
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
          <Tabs defaultValue={initialTab}>
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
              <RewriteStudio projectId={project.id} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </main>
  );
}

type UploadPhase = "idle" | "scanning" | "review" | "submitting" | "done";

function UploadFlow({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { wallets } = useWallets();
  const [files, setFiles] = React.useState<File[]>([]);
  const [phase, setPhase] = React.useState<UploadPhase>("idle");
  const [report, setReport] = React.useState<ConciergeReport | null>(null);
  const [submit, setSubmit] = React.useState<SubmitPhase>("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function handleFiles(next: File[]) {
    setFiles(next);
    setError(null);
    setPhase("scanning");
    const r = await scanFiles(next);
    setReport(r);
    setPhase("review");
  }

  function reset() {
    setFiles([]);
    setReport(null);
    setPhase("idle");
    setSubmit("idle");
    setError(null);
  }

  async function handleSubmit() {
    if (!report) return;
    const p = projectStore.get(projectId);
    const chainSession = p?.chainSession;
    if (!chainSession) {
      setError(
        "This project does not have a real FFE session yet. Create a new project to use the live finetuning path.",
      );
      return;
    }

    setPhase("submitting");
    setSubmit("encrypting");
    setError(null);

    try {
      const payloadFiles = await filesToFfePayload(files);
      setSubmit("uploading");
      const contributor = {
        id: user?.id ?? "anonymous",
        name: user?.displayName ?? "Contributor",
      };
      const participant =
        chainSession.participants?.find((item) => user && item.contributorId === user.id) ??
        chainSession.participants?.find((item) =>
          wallets.some(
            (candidate) =>
              candidate.type === "ethereum" &&
              candidate.address.toLowerCase() === item.address.toLowerCase(),
          ),
        );
      const wallet =
        chainSession.mode === "wallet-owner"
          ? wallets.find(
              (candidate) =>
                candidate.type === "ethereum" &&
                candidate.address.toLowerCase() ===
                  (participant?.address ?? chainSession.participantAddress).toLowerCase(),
            )
          : undefined;
      if (chainSession.mode === "wallet-owner" && !wallet) {
        throw new Error(
          "Connect the wallet that owns this FFE session before submitting this contribution.",
        );
      }
      const receipt = wallet
        ? await submitPreparedContributionWithWallet({
            provider: await wallet.getEthereumProvider(),
            from: wallet.address,
            prepared: await prepareFfeContribution({
              projectId,
              sessionId: chainSession.sessionId,
              contributor,
              usableCount: report.usableCount,
              files: payloadFiles,
            }),
          })
        : await submitFfeContribution({
            projectId,
            sessionId: chainSession.sessionId,
            contributor,
            usableCount: report.usableCount,
            files: payloadFiles,
          });
      setSubmit("submitted");

      if (p) {
        const updated = p.contributors.map((c) =>
          user && c.id === user.id
            ? { ...c, status: "uploaded" as const, exampleCount: report.usableCount }
            : c,
        );
        const alreadyUploaded = updated.some((c) => c.status === "uploaded");
        const patch = {
          contributors: updated,
          stage: alreadyUploaded ? "training" : p.stage,
          submissionReceipts: [...(p.submissionReceipts ?? []), receipt],
        };
        projectStore.update(projectId, patch);
        await updateProject(projectId, patch).catch((err) =>
          console.warn("Could not persist contribution receipt.", err),
        );
      }

      await new Promise((r) => setTimeout(r, 600));
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit this contribution.");
      setSubmit("idle");
      setPhase("review");
    }
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
        <div className="space-y-5">
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
                  // Mock: no-op. Real impl mutates the report.
                }}
              />
            ))}
          </div>

          <PreviewTable report={report} />

          <div className="border-border bg-surface flex flex-col items-center justify-between gap-3 rounded-[var(--radius-lg)] border p-4 sm:flex-row">
            <p className="text-foreground-muted text-xs leading-relaxed">
              Submitting sends this cleaned export through the live FFE bridge, encrypts it for the
              aggregator, uploads the ciphertext to 0G Storage, and commits the hash on-chain.
            </p>
            <Button onClick={handleSubmit} size="lg">
              <Lock className="h-4 w-4" />
              Encrypt and submit
            </Button>
          </div>

          {error && (
            <div className="border-status-danger/20 text-status-danger flex items-start gap-2 rounded-[var(--radius-md)] border bg-[var(--status-danger-bg)] p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {(phase === "submitting" || phase === "done") && (
        <div className="border-border bg-surface flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border p-10 text-center">
          <SubmitStateMachine phase={submit} />
          {phase === "done" ? (
            <>
              <div>
                <h3 className="font-serif text-3xl tracking-tight">Submitted.</h3>
                <p className="text-foreground-muted mt-1 max-w-md text-sm leading-relaxed">
                  Your contribution is on-chain and in the aggregator queue. Training starts once
                  quorum is reached for the session.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild>
                  <Link href={`/p/${projectId}`}>Back to project</Link>
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Submit more
                </Button>
              </div>
            </>
          ) : (
            <p className="text-foreground-muted text-sm">
              Keep this tab open — encryption runs locally.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewTable({ report }: { report: ConciergeReport }) {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-[var(--radius-lg)] border">
      <header className="border-border flex items-center justify-between gap-2 border-b px-5 py-3">
        <div>
          <p className="text-foreground-subtle text-xs tracking-widest uppercase">
            Preview · first 3 rows after conversion
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <Badge tone="info" className="font-mono lowercase">
            {report.detectedSchema.question}
          </Badge>
          <span className="text-foreground-subtle">→</span>
          <Badge tone="success" className="font-mono lowercase">
            {report.detectedSchema.answer}
          </Badge>
        </div>
      </header>
      <ul className="divide-border divide-y">
        {report.previewRows.map((r, i) => (
          <li key={i} className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <div>
              <p className="text-foreground-subtle mb-1 text-[10px] tracking-widest uppercase">
                Question
              </p>
              <p className="text-foreground text-sm leading-relaxed">{r.question}</p>
            </div>
            <div>
              <p className="text-foreground-subtle mb-1 text-[10px] tracking-widest uppercase">
                Answer
              </p>
              <p className="text-foreground-muted text-sm leading-relaxed">{r.answer}</p>
            </div>
          </li>
        ))}
      </ul>
      <footer className="border-border bg-surface-muted/40 border-t px-5 py-3">
        <p className="text-foreground-muted text-xs">
          Look right? Confirm the columns above and submit when ready. Wrong columns?{" "}
          <button className="text-accent underline-offset-2 hover:underline">Change mapping</button>
          .
        </p>
      </footer>
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
