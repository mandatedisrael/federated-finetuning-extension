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
  mustPassPassed: number;
  mustPassTotal: number;
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
}
