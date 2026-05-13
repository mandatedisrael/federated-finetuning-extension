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

export function seedMustPassResults(projectId: string) {
  const project = projectStore.get(projectId);
  if (!project || project.mustPass.length > 0) return;
  projectStore.update(projectId, {
    mustPass: [
      {
        id: "mp_demo1",
        prompt: "How long do I have to request a refund?",
        expected: "Acknowledges the 30-day window and the support email path.",
        result: "pass",
      },
      {
        id: "mp_demo2",
        prompt: "Can I cancel my subscription mid-cycle?",
        expected: "Explains immediate-vs-end-of-cycle options without overselling pauses.",
        result: "fail",
      },
      {
        id: "mp_demo3",
        prompt: "When will my order ship?",
        expected: "Gives the 5-7 day window and mentions tracking on dispatch.",
        result: "pass",
      },
      {
        id: "mp_demo4",
        prompt: "Do you ship internationally?",
        expected: "Says yes, names the carrier, calls out duties.",
        result: "pass",
      },
      {
        id: "mp_demo5",
        prompt: "What if my package arrives damaged?",
        expected: "Apologizes, asks for a photo, offers replacement.",
        result: "pass",
      },
    ],
  });
}

export function seedDemoVersions(projectId: string) {
  const project = projectStore.get(projectId);
  if (!project || project.versions.length > 0) return;
  const contribIds = project.contributors.map((c) => c.id);
  const now = Date.now();
  projectStore.update(projectId, {
    versions: [
      {
        id: "v_demo3",
        label: "Version 3",
        summary: "Improved refund-policy answers across the test set.",
        publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        publishedBy: project.contributors[0]?.name ?? "Owner",
        publishedById: project.ownerId,
        mustPassPassed: 5,
        mustPassTotal: 5,
        contributorIds: contribIds.slice(0, 3),
        voteSummary: { left: 4, right: 22, neither: 2 },
      },
      {
        id: "v_demo2",
        label: "Version 2",
        summary: "Adjusted tone for enterprise users.",
        publishedAt: new Date(now - 9 * 24 * 60 * 60 * 1000).toISOString(),
        publishedBy: project.contributors[0]?.name ?? "Owner",
        publishedById: project.ownerId,
        mustPassPassed: 4,
        mustPassTotal: 5,
        contributorIds: contribIds.slice(0, 4),
        voteSummary: { left: 7, right: 15, neither: 3 },
        overridden: true,
      },
      {
        id: "v_demo1",
        label: "Version 1",
        summary: "Initial run.",
        publishedAt: new Date(now - 16 * 24 * 60 * 60 * 1000).toISOString(),
        publishedBy: project.contributors[0]?.name ?? "Owner",
        publishedById: project.ownerId,
        mustPassPassed: 3,
        mustPassTotal: 4,
        contributorIds: contribIds.slice(0, 2),
        voteSummary: { left: 11, right: 9, neither: 4 },
      },
    ],
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
