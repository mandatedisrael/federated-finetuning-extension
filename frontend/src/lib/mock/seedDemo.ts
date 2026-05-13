/**
 * Seeds a demo project so any URL like /p/p_anything can resolve
 * during prototyping. Returns the existing project if already
 * present.
 */
import { projectStore } from "./projectStore";
import type { Project } from "./types";

export function ensureDemoProject(id: string): Project {
  const existing = projectStore.get(id);
  if (existing) return existing;

  return projectStore.create({
    templateId: "customer-support",
    name: "Customer Support Assistant — Demo",
    goal: "Answer customer questions in our voice, with our refund and shipping policies.",
    ownerId: "u_demo_owner",
    ownerName: "Alice Chen",
    ownerEmail: "alice@acme.co",
    invitees: [
      { identifier: "bob@acme.co", role: "contributor" },
      { identifier: "carol@acme.co", role: "contributor" },
      { identifier: "dan@acme.co", role: "contributor" },
      { identifier: "0xA1B2c3D4e5F6071829", role: "contributor" },
    ],
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    stakeUsd: 5,
  });
}

export function seedSampleProgress(projectId: string) {
  const project = projectStore.get(projectId);
  if (!project) return;
  // Lightly populate statuses for a more interesting demo.
  const updated = {
    ...project,
    contributors: project.contributors.map((c, i) => {
      if (c.role === "owner") return { ...c, status: c.status };
      const statuses = ["included", "validated", "uploaded", "not-started"] as const;
      const status = statuses[i % statuses.length] ?? "not-started";
      return { ...c, status, exampleCount: status === "not-started" ? 0 : 40 + i * 12 };
    }),
  };
  projectStore.update(projectId, updated);
}
