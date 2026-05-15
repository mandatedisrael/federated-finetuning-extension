export interface FfeApiErrorBody {
  error: string;
  details?: string;
}

export interface CreateFfeProjectSessionInput {
  templateId: string;
  name: string;
  goal: string;
  owner: {
    id: string;
    name: string;
    email: string;
    walletAddress?: string;
  };
  invitees: Array<{ identifier: string; role: "owner" | "contributor" }>;
  deadline: string;
  stakeUsd: number;
  ownerParticipant?: {
    address: string;
    publicKey: string;
    privateKey: string;
  };
  participants?: Array<{
    contributorId: string;
    address: string;
    publicKey: string;
    privateKey?: string;
  }>;
}

export interface CreateFfeProjectSessionResult {
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
  participants?: Array<{
    contributorId: string;
    address: string;
    publicKey: string;
    privateKey?: string;
  }>;
}

export interface SubmitFfeContributionFile {
  name: string;
  type: string;
  size: number;
  text: string;
}

export interface SubmitFfeContributionInput {
  projectId: string;
  sessionId: string;
  contributor: {
    id: string;
    name: string;
  };
  usableCount: number;
  files: SubmitFfeContributionFile[];
}

export interface PrepareFfeContributionInput {
  projectId: string;
  sessionId: string;
  contributor: {
    id: string;
    name: string;
  };
  usableCount: number;
  files: SubmitFfeContributionFile[];
}

export interface PrepareFfeContributionResult {
  id: string;
  contributorId: string;
  contributorName: string;
  sessionId: string;
  exampleCount: number;
  rootHash: string;
  storageTxHash: string;
  preparedAt: string;
  coordinatorAddress: string;
  chainId: number;
}

export interface SubmitFfeContributionResult {
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

export interface FfeSessionStatusResult {
  sessionId: string;
  status: "open" | "quorum-reached";
  stage: "waiting" | "checking" | "training" | "ready" | "failed";
  quorum: number;
  submittedCount: number;
  participants: string[];
  submitters: string[];
  aggregatorPubkeySet: boolean;
  failureReason?: string;
  runtimeUpdatedAt?: string;
  mintTxHash?: string;
}

export interface DownloadFfeArtifactInput {
  participantAddress: string;
  recipientPrivateKey: string;
}

export interface DownloadFfeArtifactResult {
  sessionId: string;
  tokenId: string;
  modelBlobHash: string;
  artifactSizeBytes: number;
  downloadedAt: string;
}
