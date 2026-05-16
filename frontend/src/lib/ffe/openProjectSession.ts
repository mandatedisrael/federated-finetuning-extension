import { createBrowserFfeKeyPair } from "@/lib/ffe/keys";
import { createFfeProjectSession } from "@/lib/ffe/client";
import { projectStore } from "@/lib/mock/projectStore";
import { updateProject } from "@/lib/projects/client";
import type { Contributor, Project } from "@/lib/mock/types";

interface SessionUser {
  id: string;
  displayName: string;
  email: string;
  walletAddress?: string;
}

interface SessionWallet {
  type: string;
  address: string;
}

interface OpenProjectSessionInput {
  project: Project;
  user: SessionUser;
  wallets: SessionWallet[];
}

interface OpenProjectSessionResult {
  project: Project;
  contributors: Contributor[];
}

/**
 * Lazily create the on-chain FFE session for a project, returning the
 * updated project. Idempotent: if `project.chainSession` already exists,
 * the input project is returned untouched.
 */
export async function openProjectSession({
  project,
  user,
  wallets,
}: OpenProjectSessionInput): Promise<OpenProjectSessionResult> {
  if (project.chainSession) {
    return { project, contributors: project.contributors };
  }

  let contributors = project.contributors;
  const owner = contributors.find((contributor) => contributor.id === project.ownerId);
  const ownerWallet =
    wallets.find(
      (wallet) =>
        wallet.type === "ethereum" &&
        owner?.walletAddress &&
        wallet.address.toLowerCase() === owner.walletAddress.toLowerCase(),
    ) ??
    wallets.find(
      (wallet) =>
        wallet.type === "ethereum" &&
        user.walletAddress &&
        wallet.address.toLowerCase() === user.walletAddress.toLowerCase(),
    ) ??
    wallets.find((wallet) => wallet.type === "ethereum");

  if (!ownerWallet) {
    throw new Error("Connect the owner wallet before starting the finetuning session.");
  }

  if (!owner?.ffePublicKey) {
    const keys = createBrowserFfeKeyPair();
    contributors = contributors.map((contributor) =>
      contributor.id === project.ownerId
        ? {
            ...contributor,
            walletAddress: ownerWallet.address,
            ffePublicKey: keys.publicKey,
            ffePrivateKey: keys.privateKey,
            registeredAt: new Date().toISOString(),
          }
        : contributor,
    );
  }

  const participants = contributors
    .filter((contributor) => contributor.walletAddress && contributor.ffePublicKey)
    .map((contributor) => ({
      contributorId: contributor.id,
      address: contributor.walletAddress!,
      publicKey: contributor.ffePublicKey!,
      privateKey: contributor.ffePrivateKey,
    }));

  if (participants.length === 0) {
    throw new Error("At least one registered wallet is required before starting.");
  }

  const chainSession = await createFfeProjectSession({
    templateId: project.templateId,
    name: project.name,
    goal: project.goal,
    owner: {
      id: user.id,
      name: user.displayName,
      email: user.email,
      walletAddress: ownerWallet.address,
    },
    invitees: project.contributors
      .filter((contributor) => contributor.role !== "owner")
      .map((contributor) => ({ identifier: contributor.email, role: contributor.role })),
    deadline: project.deadline,
    stakeUsd: project.stakeUsd,
    participants,
  });

  const localUpdated = projectStore.update(project.id, {
    contributors,
    chainSession,
    stage: "waiting",
  });

  void updateProject(project.id, {
    contributors,
    chainSession,
    stage: "waiting",
  }).catch((err) => console.warn("Could not persist FFE session.", err));

  return { project: localUpdated ?? { ...project, contributors, chainSession, stage: "waiting" }, contributors };
}
