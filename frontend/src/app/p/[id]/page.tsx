"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { TrustBadge } from "@/components/domain/TrustBadge";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthProvider";
import { projectStore } from "@/lib/mock/projectStore";
import { ensureDemoProject, seedSampleProgress } from "@/lib/mock/seedDemo";
import { getTemplate } from "@/lib/mock/templates";
import type { Project } from "@/lib/mock/types";

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    const p = projectStore.get(id) ?? ensureDemoProject(id);
    // demo polish: seed contributor statuses the first time
    if (p.contributors.every((c) => c.status === "not-started")) {
      seedSampleProgress(p.id);
    }
    setProject(projectStore.get(id) ?? null);
  }, [params?.id]);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-foreground-muted text-sm">Loading project…</p>
      </main>
    );
  }

  const template = getTemplate(project.templateId);
  const isOwner = user?.id === project.ownerId;

  return (
    <main className="relative flex flex-1 flex-col">
      <header className="border-border mx-auto flex w-full max-w-6xl items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg tracking-tight">
            FFE<span className="text-foreground-subtle">.</span>
          </Link>
          <span className="text-foreground-subtle text-xs">/</span>
          <span className="text-foreground-muted truncate text-sm">{project.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {isOwner ? (
            <Badge tone="accent" outline>
              Owner
            </Badge>
          ) : (
            <Badge>Contributor</Badge>
          )}
          <TrustBadge />
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {template && (
            <p className="text-foreground-subtle mb-3 text-xs tracking-[0.18em] uppercase">
              {template.name}
            </p>
          )}
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{project.name}</h1>
          <p className="text-foreground-muted mt-3 max-w-2xl text-base leading-relaxed">
            {project.goal}
          </p>
        </motion.div>

        {/* Placeholder slots for: progress bar, contributor list,
            readiness checklist, owner controls. Built in next commits. */}
        <div className="border-border bg-surface-muted/40 text-foreground-muted mt-10 rounded-[var(--radius-lg)] border border-dashed p-10 text-center text-sm">
          Dashboard sections coming online — progress, contributors, readiness checklist, banners.
        </div>
      </section>
    </main>
  );
}
