import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  Contributor,
  MustPassScenario,
  Project,
  ProjectChainParticipant,
  ProjectChainSession,
  ProjectInviteDelivery,
  ProjectSubmissionReceipt,
  ProjectVersion,
} from "@/lib/mock/types";

type JsonRecord = Record<string, unknown>;

interface ProjectRow {
  id: string;
  template_id: string;
  name: string;
  goal: string;
  owner_privy_id: string;
  stage: Project["stage"];
  deadline: string;
  stake_usd: number | string;
  invite_code: string;
  created_at: string;
}

interface ContributorRow {
  id: string;
  name: string;
  email: string;
  role: Contributor["role"];
  status: Contributor["status"];
  example_count: number;
  avatar_url?: string | null;
  wallet_address?: string | null;
  ffe_public_key?: string | null;
  registered_at?: string | null;
}

interface ChainSessionRow {
  mode: ProjectChainSession["mode"];
  session_id: string;
  base_model: string;
  participant_address: string;
  participant_pubkey: string;
  aggregator_pubkey: string;
  create_tx_hash: string;
  set_aggregator_tx_hash?: string | null;
  created_at: string;
}

interface ChainParticipantRow {
  contributor_id: string;
  address: string;
  public_key: string;
}

interface SubmissionReceiptRow {
  id: string;
  contributor_id: string;
  contributor_name: string;
  session_id: string;
  example_count: number;
  root_hash: string;
  storage_tx_hash: string;
  submit_tx_hash: string;
  submitted_at: string;
}

interface InviteDeliveryRow {
  recipient: string;
  status: ProjectInviteDelivery["status"];
  message_id?: string | null;
  error?: string | null;
  sent_at: string;
}

interface MustPassRow {
  id: string;
  prompt: string;
  expected: string;
  result?: MustPassScenario["result"] | null;
  position: number;
}

interface VersionRow {
  id: string;
  label: string;
  summary: string;
  published_at: string;
  published_by: string;
  published_by_id: string;
  must_pass_passed: number;
  must_pass_total: number;
  contributor_ids: string[];
  vote_summary?: ProjectVersion["voteSummary"] | null;
  overridden?: boolean | null;
}

export function hasProjectDatabase() {
  return isSupabaseConfigured();
}

export async function saveProjectToSupabase(project: Project) {
  const supabase = getSupabaseAdminClient();
  await assertOk(
    supabase.from("ffe_projects").upsert(projectToRow(project), { onConflict: "id" }),
    "save project",
  );

  await replaceProjectChildren(project);
  await appendProjectEvent(project.id, project.ownerId, "project.saved", {
    stage: project.stage,
    contributorCount: project.contributors.length,
  });

  return getProjectFromSupabase(project.id);
}

export async function updateProjectInSupabase(id: string, patch: Partial<Project>) {
  const existing = await getProjectFromSupabase(id);
  if (!existing) return null;
  return saveProjectToSupabase({ ...existing, ...patch });
}

export async function getProjectFromSupabase(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ffe_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return hydrateProject(data as ProjectRow);
}

export async function getProjectByInviteCodeFromSupabase(code: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ffe_projects")
    .select("*")
    .ilike("invite_code", code.trim())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return hydrateProject(data as ProjectRow);
}

export async function registerContributorInSupabase(input: {
  projectId: string;
  inviteCode: string;
  userId: string;
  displayName: string;
  email: string;
  walletAddress: string;
  ffePublicKey: string;
}) {
  const project = await getProjectFromSupabase(input.projectId);
  if (!project || project.inviteCode.toUpperCase() !== input.inviteCode.trim().toUpperCase()) {
    return null;
  }

  const target =
    project.contributors.find((contributor) => contributor.id === input.userId) ??
    project.contributors.find(
      (contributor) => contributor.email.toLowerCase() === input.email.toLowerCase(),
    ) ??
    project.contributors.find(
      (contributor) =>
        contributor.walletAddress &&
        contributor.walletAddress.toLowerCase() === input.walletAddress.toLowerCase(),
    ) ??
    project.contributors.find(
      (contributor) => contributor.role !== "owner" && !contributor.registeredAt,
    );

  if (!target) {
    throw new Error("This project already has all invite seats registered.");
  }

  if (target.id !== input.userId) {
    const supabase = getSupabaseAdminClient();
    await assertOk(
      supabase.from("ffe_contributors").delete().eq("project_id", project.id).eq("id", target.id),
      "claim invite seat",
    );
  }

  const contributors = project.contributors.map((contributor) =>
    contributor.id === target.id
      ? {
          ...contributor,
          id: input.userId,
          name: input.displayName || contributor.name,
          email: input.email || contributor.email,
          walletAddress: input.walletAddress,
          ffePublicKey: input.ffePublicKey,
          registeredAt: new Date().toISOString(),
        }
      : contributor,
  );

  await appendProjectEvent(project.id, input.userId, "contributor.registered", {
    contributorId: input.userId,
    walletAddress: input.walletAddress,
  });

  return saveProjectToSupabase({ ...project, contributors });
}

async function replaceProjectChildren(project: Project) {
  const supabase = getSupabaseAdminClient();

  await assertOk(
    supabase.from("ffe_contributors").upsert(
      project.contributors.map((c) => contributorToRow(project.id, c)),
      {
        onConflict: "id",
      },
    ),
    "save contributors",
  );

  await assertOk(
    supabase.from("ffe_must_pass_scenarios").delete().eq("project_id", project.id),
    "clear scenarios",
  );
  if (project.mustPass.length > 0) {
    await assertOk(
      supabase
        .from("ffe_must_pass_scenarios")
        .insert(project.mustPass.map((s, i) => mustPassToRow(project.id, s, i))),
      "save scenarios",
    );
  }

  await assertOk(
    supabase.from("ffe_project_versions").delete().eq("project_id", project.id),
    "clear versions",
  );
  if (project.versions.length > 0) {
    await assertOk(
      supabase
        .from("ffe_project_versions")
        .insert(project.versions.map((v) => versionToRow(project.id, v))),
      "save versions",
    );
  }

  if (project.chainSession) {
    await assertOk(
      supabase
        .from("ffe_chain_sessions")
        .upsert(chainSessionToRow(project.id, project.chainSession), {
          onConflict: "project_id",
        }),
      "save chain session",
    );
    await assertOk(
      supabase.from("ffe_chain_participants").delete().eq("project_id", project.id),
      "clear chain participants",
    );
    if (project.chainSession.participants?.length) {
      await assertOk(
        supabase
          .from("ffe_chain_participants")
          .insert(
            project.chainSession.participants.map((p) =>
              participantToRow(project.id, project.chainSession!, p),
            ),
          ),
        "save chain participants",
      );
    }
  }

  if (project.submissionReceipts?.length) {
    await assertOk(
      supabase.from("ffe_submission_receipts").upsert(
        project.submissionReceipts.map((r) => submissionToRow(project.id, r)),
        { onConflict: "id" },
      ),
      "save submission receipts",
    );
  }

  if (project.inviteDeliveries?.length) {
    await assertOk(
      supabase.from("ffe_invite_deliveries").upsert(
        project.inviteDeliveries.map((d) => ({
          project_id: project.id,
          contributor_id: project.contributors.find(
            (c) => c.email.toLowerCase() === d.recipient.toLowerCase(),
          )?.id,
          recipient: d.recipient,
          status: d.status,
          message_id: d.messageId,
          error: d.error,
          sent_at: d.sentAt,
        })),
        { onConflict: "project_id,recipient,sent_at" },
      ),
      "save invite deliveries",
    );
  }
}

async function hydrateProject(row: ProjectRow): Promise<Project> {
  const supabase = getSupabaseAdminClient();
  const [
    contributorsResult,
    scenariosResult,
    versionsResult,
    sessionResult,
    participantsResult,
    receiptsResult,
    deliveriesResult,
  ] = await Promise.all([
    supabase.from("ffe_contributors").select("*").eq("project_id", row.id).order("created_at"),
    supabase.from("ffe_must_pass_scenarios").select("*").eq("project_id", row.id).order("position"),
    supabase
      .from("ffe_project_versions")
      .select("*")
      .eq("project_id", row.id)
      .order("published_at"),
    supabase.from("ffe_chain_sessions").select("*").eq("project_id", row.id).maybeSingle(),
    supabase
      .from("ffe_chain_participants")
      .select("*")
      .eq("project_id", row.id)
      .order("created_at"),
    supabase
      .from("ffe_submission_receipts")
      .select("*")
      .eq("project_id", row.id)
      .order("submitted_at"),
    supabase.from("ffe_invite_deliveries").select("*").eq("project_id", row.id).order("sent_at"),
  ]);

  for (const result of [
    contributorsResult,
    scenariosResult,
    versionsResult,
    sessionResult,
    participantsResult,
    receiptsResult,
    deliveriesResult,
  ]) {
    if (result.error) throw result.error;
  }

  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    goal: row.goal,
    ownerId: row.owner_privy_id,
    contributors: ((contributorsResult.data ?? []) as ContributorRow[]).map(rowToContributor),
    stage: row.stage,
    deadline: String(row.deadline),
    stakeUsd: Number(row.stake_usd),
    inviteCode: row.invite_code,
    mustPass: ((scenariosResult.data ?? []) as MustPassRow[]).map(rowToMustPass),
    versions: ((versionsResult.data ?? []) as VersionRow[]).map(rowToVersion),
    createdAt: row.created_at,
    chainSession: rowToChainSession(
      sessionResult.data as ChainSessionRow | null,
      (participantsResult.data ?? []) as ChainParticipantRow[],
    ),
    submissionReceipts: ((receiptsResult.data ?? []) as SubmissionReceiptRow[]).map(
      rowToSubmission,
    ),
    inviteDeliveries: ((deliveriesResult.data ?? []) as InviteDeliveryRow[]).map(
      rowToInviteDelivery,
    ),
  };
}

async function appendProjectEvent(
  projectId: string,
  actorPrivyId: string | undefined,
  eventType: string,
  payload: JsonRecord,
) {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();
  await supabase.from("ffe_project_events").insert({
    project_id: projectId,
    actor_privy_id: actorPrivyId,
    event_type: eventType,
    payload,
  });
}

async function assertOk<T extends { error: unknown }>(
  resultPromise: PromiseLike<T>,
  action: string,
) {
  const result = await resultPromise;
  if (result.error) {
    throw new Error(
      `Could not ${action}: ${String((result.error as { message?: string }).message ?? result.error)}`,
    );
  }
}

function projectToRow(project: Project) {
  return {
    id: project.id,
    template_id: project.templateId,
    name: project.name,
    goal: project.goal,
    owner_privy_id: project.ownerId,
    stage: project.stage,
    deadline: project.deadline,
    stake_usd: project.stakeUsd,
    invite_code: project.inviteCode,
    created_at: project.createdAt,
  };
}

function contributorToRow(projectId: string, contributor: Contributor) {
  return {
    id: contributor.id,
    project_id: projectId,
    name: contributor.name,
    email: contributor.email,
    role: contributor.role,
    status: contributor.status,
    example_count: contributor.exampleCount,
    avatar_url: contributor.avatarUrl,
    wallet_address: contributor.walletAddress,
    ffe_public_key: contributor.ffePublicKey,
    registered_at: contributor.registeredAt,
  };
}

function mustPassToRow(projectId: string, scenario: MustPassScenario, position: number) {
  return {
    id: scenario.id,
    project_id: projectId,
    prompt: scenario.prompt,
    expected: scenario.expected,
    result: scenario.result,
    position,
  };
}

function versionToRow(projectId: string, version: ProjectVersion) {
  return {
    id: version.id,
    project_id: projectId,
    label: version.label,
    summary: version.summary,
    published_at: version.publishedAt,
    published_by: version.publishedBy,
    published_by_id: version.publishedById,
    must_pass_passed: version.mustPassPassed,
    must_pass_total: version.mustPassTotal,
    contributor_ids: version.contributorIds,
    vote_summary: version.voteSummary,
    overridden: version.overridden,
  };
}

function chainSessionToRow(projectId: string, session: ProjectChainSession) {
  return {
    project_id: projectId,
    mode: session.mode,
    session_id: session.sessionId,
    base_model: session.baseModel,
    participant_address: session.participantAddress,
    participant_pubkey: session.participantPubkey,
    aggregator_pubkey: session.aggregatorPubkey,
    create_tx_hash: session.createTxHash,
    set_aggregator_tx_hash: session.setAggregatorTxHash,
    created_at: session.createdAt,
  };
}

function participantToRow(
  projectId: string,
  session: ProjectChainSession,
  participant: ProjectChainParticipant,
) {
  return {
    project_id: projectId,
    session_id: session.sessionId,
    contributor_id: participant.contributorId,
    address: participant.address,
    public_key: participant.publicKey,
  };
}

function submissionToRow(projectId: string, receipt: ProjectSubmissionReceipt) {
  return {
    id: receipt.id,
    project_id: projectId,
    contributor_id: receipt.contributorId,
    contributor_name: receipt.contributorName,
    session_id: receipt.sessionId,
    example_count: receipt.exampleCount,
    root_hash: receipt.rootHash,
    storage_tx_hash: receipt.storageTxHash,
    submit_tx_hash: receipt.submitTxHash,
    submitted_at: receipt.submittedAt,
  };
}

function rowToContributor(row: ContributorRow): Contributor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    exampleCount: row.example_count,
    avatarUrl: row.avatar_url ?? undefined,
    walletAddress: row.wallet_address ?? undefined,
    ffePublicKey: row.ffe_public_key ?? undefined,
    registeredAt: row.registered_at ?? undefined,
  };
}

function rowToMustPass(row: MustPassRow): MustPassScenario {
  return {
    id: row.id,
    prompt: row.prompt,
    expected: row.expected,
    result: row.result ?? undefined,
  };
}

function rowToVersion(row: VersionRow): ProjectVersion {
  return {
    id: row.id,
    label: row.label,
    summary: row.summary,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    publishedById: row.published_by_id,
    mustPassPassed: row.must_pass_passed,
    mustPassTotal: row.must_pass_total,
    contributorIds: row.contributor_ids,
    voteSummary: row.vote_summary ?? undefined,
    overridden: row.overridden ?? undefined,
  };
}

function rowToChainSession(
  row: ChainSessionRow | null,
  participants: ChainParticipantRow[],
): ProjectChainSession | undefined {
  if (!row) return undefined;
  return {
    mode: row.mode,
    sessionId: row.session_id,
    baseModel: row.base_model,
    participantAddress: row.participant_address,
    participantPubkey: row.participant_pubkey,
    participantPrivateKey: "",
    aggregatorPubkey: row.aggregator_pubkey,
    createTxHash: row.create_tx_hash,
    setAggregatorTxHash: row.set_aggregator_tx_hash ?? undefined,
    createdAt: row.created_at,
    participants: participants.map((participant) => ({
      contributorId: participant.contributor_id,
      address: participant.address,
      publicKey: participant.public_key,
    })),
  };
}

function rowToSubmission(row: SubmissionReceiptRow): ProjectSubmissionReceipt {
  return {
    id: row.id,
    contributorId: row.contributor_id,
    contributorName: row.contributor_name,
    sessionId: row.session_id,
    exampleCount: row.example_count,
    rootHash: row.root_hash,
    storageTxHash: row.storage_tx_hash,
    submitTxHash: row.submit_tx_hash,
    submittedAt: row.submitted_at,
  };
}

function rowToInviteDelivery(row: InviteDeliveryRow): ProjectInviteDelivery {
  return {
    recipient: row.recipient,
    status: row.status,
    messageId: row.message_id ?? undefined,
    error: row.error ?? undefined,
    sentAt: row.sent_at,
  };
}
