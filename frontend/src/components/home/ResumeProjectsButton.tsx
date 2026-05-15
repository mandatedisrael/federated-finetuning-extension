"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock3, FolderClock, Loader2, Sparkles, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
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

function isProjectVisibleToActor(project: Project, actorId: string) {
  return (
    project.ownerId === actorId ||
    project.contributors.some((contributor) => contributor.id === actorId)
  );
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

export function ResumeProjectsButton() {
  const { user, status } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setLoading(true);
      setError(null);

      const allLocalProjects = projectStore.list();
      const actorLocalProjects =
        status === "authenticated" && user?.id
          ? sortProjects(
              allLocalProjects.filter((project) => isProjectVisibleToActor(project, user.id)),
            )
          : sortProjects(allLocalProjects);
      if (status !== "authenticated" || !user?.id) {
        if (!cancelled) {
          setProjects(actorLocalProjects);
          setLoading(false);
        }
        return;
      }

      try {
        const remoteProjects = await listProjectsForActor(user.id);
        if (cancelled) return;
        setProjects(sortProjects(dedupeProjects([...remoteProjects, ...actorLocalProjects])));
      } catch (err) {
        if (cancelled) return;
        setProjects(actorLocalProjects);
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

  if (!loading && projects.length === 0) return null;

  const headline =
    status === "authenticated" ? "Resume your sessions" : "Resume on this device";
  const subcopy =
    status === "authenticated"
      ? "Your active work is waiting here whenever you come back."
      : "Projects cached in this browser stay resumable even while you're signed out.";
  const buttonLabel = loading ? "Loading sessions" : `Resume${projects.length > 0 ? ` (${projects.length})` : ""}`;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="border-accent/20 bg-accent/6 text-foreground hover:border-accent/35 hover:bg-accent/10 shadow-[0_10px_30px_rgba(58,88,229,0.08)]"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderClock className="h-3.5 w-3.5 text-accent" />
          )}
          <span>{buttonLabel}</span>
          {!loading && projects.length > 0 ? (
            <span className="bg-accent text-accent-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px]">
              {projects.length}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(100vw,34rem)]">
        <SheetHeader>
          <SheetTitle>{headline}</SheetTitle>
          <SheetDescription>{subcopy}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {error ? <p className="text-status-warning text-xs">{error}</p> : null}

          {loading ? (
            <div className="border-border bg-surface-muted/40 flex items-center gap-3 rounded-[var(--radius-lg)] border p-4">
              <Loader2 className="text-foreground-subtle h-4 w-4 animate-spin" />
              <p className="text-foreground-muted text-sm">Pulling your recent sessions back in…</p>
            </div>
          ) : null}

          {!loading && projects.length === 0 ? (
            <div className="border-border bg-surface-muted/30 rounded-[var(--radius-lg)] border border-dashed p-5">
              <p className="text-foreground text-sm font-medium tracking-tight">
                Nothing to resume yet.
              </p>
              <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
                Once you create or join a project, it will show up here for quick access.
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            {projects.map((project) => {
              const actorId = user?.id;
              const me = actorId
                ? project.contributors.find((contributor) => contributor.id === actorId)
                : undefined;
              const collaboratorCount = project.contributors.filter(
                (contributor) => contributor.role !== "owner",
              ).length;
              const uploadedCount = project.contributors.filter(
                (contributor) => contributor.status !== "not-started",
              ).length;

              return (
                <div
                  key={project.id}
                  className="border-border bg-surface rounded-[var(--radius-lg)] border p-4"
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

                  <p className="text-foreground-muted mt-3 line-clamp-2 text-sm leading-relaxed">
                    {project.goal}
                  </p>

                  <div className="text-foreground-muted mt-4 flex flex-wrap items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      {collaboratorCount === 0
                        ? "Solo"
                        : `${collaboratorCount} collaborator${collaboratorCount === 1 ? "" : "s"}`}
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

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-foreground-subtle text-xs">
                      {me?.role === "owner" || project.ownerId === actorId ? "Owner" : "Contributor"}
                      {" • "}
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
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
