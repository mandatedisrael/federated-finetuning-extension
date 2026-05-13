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
