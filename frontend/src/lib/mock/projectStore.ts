/**
 * Mock project store. Lives in localStorage so the wizard, dashboard,
 * and contribute pages can share state across reloads during demo /
 * prototyping. Swap this file for a real API client later.
 */

import type { Project, Contributor, Role } from "./types";

const STORAGE_KEY = "ffe:projects";

function load(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function save(projects: Project[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function shortId(prefix: string) {
  const hex = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${hex}`;
}

function inviteCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${part()}-${part()}`;
}

export interface CreateProjectInput {
  templateId: string;
  name: string;
  goal: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerWalletAddress?: string;
  invitees: Array<{ identifier: string; role: Role }>;
  deadline: string;
  stakeUsd: number;
}

function contributorFromInvitee(inv: { identifier: string; role: Role }, i: number): Contributor {
  const isEmail = inv.identifier.includes("@");
  const name = isEmail
    ? (inv.identifier
        .split("@")[0]
        ?.replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) ?? `Contributor ${i + 1}`)
    : `${inv.identifier.slice(0, 6)}…${inv.identifier.slice(-4)}`;
  return {
    id: shortId("c"),
    name,
    email: isEmail ? inv.identifier : `${inv.identifier}@wallet`,
    role: inv.role,
    status: "not-started",
    exampleCount: 0,
    walletAddress: /^0x[a-fA-F0-9]{6,}$/.test(inv.identifier) ? inv.identifier : undefined,
  };
}

export const projectStore = {
  list(): Project[] {
    return load();
  },

  get(id: string): Project | undefined {
    return load().find((p) => p.id === id);
  },

  findByInviteCode(code: string): Project | undefined {
    const normalized = code.trim().toUpperCase();
    return load().find((p) => p.inviteCode.toUpperCase() === normalized);
  },

  create(input: CreateProjectInput): Project {
    const id = shortId("p");
    const owner: Contributor = {
      id: input.ownerId,
      name: input.ownerName,
      email: input.ownerEmail,
      role: "owner",
      status: "not-started",
      exampleCount: 0,
      walletAddress: input.ownerWalletAddress,
    };
    const project: Project = {
      id,
      templateId: input.templateId,
      name: input.name,
      goal: input.goal,
      ownerId: input.ownerId,
      contributors: [
        owner,
        ...input.invitees
          .filter((i) => i.identifier.trim().length > 0)
          .map((inv, i) => contributorFromInvitee(inv, i)),
      ],
      stage: "waiting",
      deadline: input.deadline,
      stakeUsd: input.stakeUsd,
      inviteCode: inviteCode(),
      mustPass: [],
      versions: [],
      createdAt: new Date().toISOString(),
    };
    const all = load();
    all.push(project);
    save(all);
    return project;
  },

  put(project: Project): Project {
    const all = load();
    const idx = all.findIndex((p) => p.id === project.id);
    if (idx === -1) {
      all.push(project);
    } else {
      all[idx] = project;
    }
    save(all);
    return project;
  },

  update(id: string, patch: Partial<Project>): Project | undefined {
    const all = load();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    const existing = all[idx];
    if (!existing) return undefined;
    const next: Project = { ...existing, ...patch };
    all[idx] = next;
    save(all);
    return next;
  },
};
