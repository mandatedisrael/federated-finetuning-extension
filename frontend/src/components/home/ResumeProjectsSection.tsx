"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Loader2, Sparkles, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import type { Project } from "@/lib/mock/types";
import { listProjectsForActor } from "@/lib/projects/client";

function dedupeProjects(projects: Project[]) {
  const seen = new Set<string>();
  return projects.filter((project) => {
    if (seen.has(project.id)) return false;
    seen.add(project.id);
    return true;
  });
}

function sortProjects(projects: Project[]) {
  return [...projects].sort((a, b) => {
    const stageRank = (project: Project) => {
      if (project.stage === "failed") return 0;
      if (project.stage === "training") return 1;
      if (project.stage === "checking") return 2;
      if (project.stage === "waiting") return 3;
      return 4;
    };
    const rank = stageRank(a) - stageRank(b);
    if (rank !== 0) return rank;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function stageLabel(project: Project) {
  switch (project.stage) {
    case "failed":
      return "Needs attention";
    case "training":
      return "Training live";
    case "checking":
      return "Checking data";
    case "ready":
      return "Ready";
    default:
      return project.chainSession ? "Waiting on contributions" : "Draft";
  }
}

function actionLabel(project: Project, actorId?: string) {
  const isOwner = actorId && project.ownerId === actorId;
  if (project.stage === "ready") return "Open results";
  if (project.stage === "failed") return "Review run";
  if (!project.chainSession) return isOwner ? "Resume setup" : "Open project";
  return "Resume session";
}

function actionHref(project: Project) {
  if (project.stage === "ready") return `/p/${project.id}/result`;
  return `/p/${project.id}`;
}

export function ResumeProjectsSection() {
  const { user, status } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setLoading(true);
      setError(null);

      const localProjects = sortProjects(projectStore.list());
      if (status !== "authenticated" || !user?.id) {
        if (!cancelled) {
          setProjects(localProjects);
          setLoading(false);
        }
        return;
      }

      try {
        const remoteProjects = await listProjectsForActor(user.id);
        if (cancelled) return;
        setProjects(sortProjects(dedupeProjects([...remoteProjects, ...localProjects])));
      } catch (err) {
        if (cancelled) return;
        setProjects(localProjects);
        setError(err instanceof Error ? err.message : "Could not load your sessions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [status, user?.id]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-7xl px-6 pt-2 pb-10">
        <div className="border-border bg-surface flex items-center gap-3 rounded-[var(--radius-lg)] border p-5">
          <Loader2 className="text-foreground-subtle h-4 w-4 animate-spin" />
          <p className="text-foreground-muted text-sm">Pulling your recent sessions back in…</p>
        </div>
      </section>
    );
  }

  if (projects.length === 0) return null;

  const headline =
    status === "authenticated" ? "Resume your sessions" : "Resume on this device";
  const subcopy =
    status === "authenticated"
      ? "Your active projects are waiting here, even if you just signed back in."
      : "Projects cached in this browser are still available while you're signed out.";

  return (
    <section className="mx-auto w-full max-w-7xl px-6 pt-2 pb-10">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-foreground-subtle text-xs tracking-[0.2em] uppercase">
            Continue where you left off
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">{headline}</h2>
          <p className="text-foreground-muted mt-2 max-w-2xl text-sm leading-relaxed">
            {subcopy}
          </p>
        </div>
        {error && <p className="text-status-warning text-xs">{error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const actorId = user?.id;
          const me = actorId
            ? project.contributors.find((contributor) => contributor.id === actorId)
            : undefined;
          const collaboratorCount = project.contributors.filter((c) => c.role !== "owner").length;
          const uploadedCount = project.contributors.filter((c) => c.status !== "not-started").length;
          return (
            <div
              key={project.id}
              className="border-border bg-surface flex h-full flex-col rounded-[var(--radius-lg)] border p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-foreground-subtle text-[10px] tracking-[0.18em] uppercase">
                    {project.chainSession ? "Ongoing session" : "Draft project"}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl tracking-tight">{project.name}</h3>
                </div>
                <Badge
                  tone={
                    project.stage === "failed"
                      ? "warning"
                      : project.stage === "ready"
                        ? "success"
                        : "accent"
                  }
                  outline={project.stage === "waiting"}
                >
                  {stageLabel(project)}
                </Badge>
              </div>

              <p className="text-foreground-muted mt-3 line-clamp-3 text-sm leading-relaxed">
                {project.goal}
              </p>

              <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
                <div className="border-border bg-surface-muted/50 rounded-[var(--radius-md)] border p-3">
                  <p className="text-foreground-subtle tracking-[0.16em] uppercase">Role</p>
                  <p className="text-foreground mt-2 text-sm font-medium tracking-tight">
                    {me?.role === "owner" || project.ownerId === actorId ? "Owner" : "Contributor"}
                  </p>
                </div>
                <div className="border-border bg-surface-muted/50 rounded-[var(--radius-md)] border p-3">
                  <p className="text-foreground-subtle tracking-[0.16em] uppercase">Stage</p>
                  <p className="text-foreground mt-2 text-sm font-medium tracking-tight">
                    {project.stage === "training"
                      ? "Training live"
                      : project.stage === "failed"
                        ? "Run interrupted"
                        : project.stage === "ready"
                          ? "Published model"
                          : "In progress"}
                  </p>
                </div>
              </div>

              <div className="text-foreground-muted mt-4 flex flex-wrap items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {collaboratorCount === 0 ? "Solo" : `${collaboratorCount} collaborator${collaboratorCount === 1 ? "" : "s"}`}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadedCount}/{project.contributors.length} uploaded
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5" />
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-foreground-subtle text-xs">
                  {project.chainSession
                    ? `Session #${project.chainSession.sessionId}`
                    : "Not started on-chain yet"}
                </span>
                <Button asChild>
                  <Link href={actionHref(project)}>
                    {project.stage === "ready" ? <Sparkles className="h-4 w-4" /> : null}
                    {actionLabel(project, actorId)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
