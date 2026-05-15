/**
 * Mock data types. These mirror the shape we expect from the real
 * aggregator/SDK so the swap is type-isolated to dataClient.ts.
 */

export interface Template {
  id: string;
  name: string;
  goal: string;
  description: string;
  recommendedContributors: string;
  exampleFormats: string[];
  minExamples: number;
  surface: "friendly" | "technical";
  icon: string;
}

export type ProjectStage = "waiting" | "checking" | "training" | "ready";

export type ContributionStatus =
  | "not-started"
  | "uploaded"
  | "validated"
  | "included"
  | "needs-attention"
  | "rejected";

export type Role = "owner" | "contributor";

export interface Contributor {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: ContributionStatus;
  exampleCount: number;
  avatarUrl?: string;
  walletAddress?: string;
  ffePublicKey?: string;
  ffePrivateKey?: string;
  registeredAt?: string;
}

export interface MustPassScenario {
  id: string;
  prompt: string;
  expected: string;
  result?: "pass" | "fail";
}

export interface ProjectVersion {
  id: string;
  label: string;
  summary: string;
  publishedAt: string;
  publishedBy: string;
  publishedById: string;
  mustPassPassed: number;
  mustPassTotal: number;
  contributorIds: string[];
  voteSummary?: { left: number; right: number; neither: number };
  overridden?: boolean;
}

export interface Project {
  id: string;
  templateId: string;
  name: string;
  goal: string;
  ownerId: string;
  contributors: Contributor[];
  stage: ProjectStage;
  deadline: string; // ISO
  stakeUsd: number;
  inviteCode: string;
  mustPass: MustPassScenario[];
  versions: ProjectVersion[];
  createdAt: string;
  chainSession?: ProjectChainSession;
  submissionReceipts?: ProjectSubmissionReceipt[];
  inviteDeliveries?: ProjectInviteDelivery[];
  activityEvents?: ProjectActivityEvent[];
}

export interface ProjectInviteDelivery {
  recipient: string;
  status: "sent" | "preview" | "failed";
  messageId?: string;
  error?: string;
  sentAt: string;
}

export interface ProjectActivityEvent {
  id: string;
  type: string;
  actorPrivyId?: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface ProjectChainSession {
  mode: "server-proxy" | "wallet-owner";
  sessionId: string;
  baseModel: string;
  participantAddress: string;
  participantPubkey: string;
  participantPrivateKey: string;
  aggregatorPubkey: string;
  createTxHash: string;
  setAggregatorTxHash?: string;
  createdAt: string;
  participants?: ProjectChainParticipant[];
}

export interface ProjectChainParticipant {
  contributorId: string;
  address: string;
  publicKey: string;
  privateKey?: string;
}

export interface ProjectSubmissionReceipt {
  id: string;
  contributorId: string;
  contributorName: string;
  sessionId: string;
  exampleCount: number;
  rootHash: string;
  storageTxHash: string;
  submitTxHash: string;
  submittedAt: string;
}
