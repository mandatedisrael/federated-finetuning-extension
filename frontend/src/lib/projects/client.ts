import { projectStore } from "@/lib/mock/projectStore";
import type { Project } from "@/lib/mock/types";

interface ProjectResponse {
  project: Project;
}

interface ApiErrorBody {
  error?: string;
}

export async function saveProject(project: Project) {
  const result = await projectRequest("/api/projects", {
    method: "POST",
    body: JSON.stringify(project),
  });
  return cacheProjectWithLocalSecrets(result.project);
}

export async function loadProject(id: string) {
  const result = await projectRequest(`/api/projects/${encodeURIComponent(id)}`);
  return cacheProjectWithLocalSecrets(result.project);
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const result = await projectRequest(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return cacheProjectWithLocalSecrets(result.project);
}

export async function loadProjectByInviteCode(code: string) {
  const result = await projectRequest(`/api/projects/invite/${encodeURIComponent(code.trim())}`);
  return cacheProjectWithLocalSecrets(result.project);
}

export async function registerProjectContributor(input: {
  projectId: string;
  inviteCode: string;
  userId: string;
  displayName: string;
  email: string;
  walletAddress: string;
  ffePublicKey: string;
  ffePrivateKey: string;
}) {
  const result = await projectRequest(
    `/api/projects/${encodeURIComponent(input.projectId)}/register`,
    {
      method: "POST",
      body: JSON.stringify({
        inviteCode: input.inviteCode,
        userId: input.userId,
        displayName: input.displayName,
        email: input.email,
        walletAddress: input.walletAddress,
        ffePublicKey: input.ffePublicKey,
      }),
    },
  );
  const withPrivateKey: Project = {
    ...result.project,
    contributors: result.project.contributors.map((contributor) =>
      contributor.id === input.userId
        ? { ...contributor, ffePrivateKey: input.ffePrivateKey }
        : contributor,
    ),
    chainSession: result.project.chainSession
      ? {
          ...result.project.chainSession,
          participants: result.project.chainSession.participants?.map((participant) =>
            participant.contributorId === input.userId
              ? { ...participant, privateKey: input.ffePrivateKey }
              : participant,
          ),
        }
      : undefined,
  };
  return cacheProjectWithLocalSecrets(withPrivateKey);
}

export function cacheProjectWithLocalSecrets(project: Project) {
  const local = projectStore.get(project.id);
  const merged = local ? mergeLocalSecrets(project, local) : project;
  const updated = projectStore.update(project.id, merged);
  if (updated) return updated;
  projectStore.put(merged);
  return merged;
}

async function projectRequest(path: string, init?: RequestInit): Promise<ProjectResponse> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(body?.error ?? `Project request failed (${response.status})`);
  }
  return (await response.json()) as ProjectResponse;
}

function mergeLocalSecrets(remote: Project, local: Project): Project {
  return {
    ...remote,
    contributors: remote.contributors.map((contributor) => {
      const cached =
        local.contributors.find((item) => item.id === contributor.id) ??
        local.contributors.find(
          (item) => item.email.toLowerCase() === contributor.email.toLowerCase(),
        );
      return cached?.ffePrivateKey && !contributor.ffePrivateKey
        ? { ...contributor, ffePrivateKey: cached.ffePrivateKey }
        : contributor;
    }),
    chainSession: mergeChainSessionSecrets(remote, local),
  };
}

function mergeChainSessionSecrets(remote: Project, local: Project) {
  if (!remote.chainSession) return undefined;
  const localSession = local.chainSession;
  return {
    ...remote.chainSession,
    participantPrivateKey:
      remote.chainSession.participantPrivateKey || localSession?.participantPrivateKey || "",
    participants: remote.chainSession.participants?.map((participant) => {
      const cached = localSession?.participants?.find(
        (item) => item.contributorId === participant.contributorId,
      );
      return cached?.privateKey && !participant.privateKey
        ? { ...participant, privateKey: cached.privateKey }
        : participant;
    }),
  };
}
