import type { ProjectInviteDelivery } from "@/lib/mock/types";

export interface SendProjectInvitesInput {
  projectId: string;
  projectName: string;
  ownerName: string;
  origin: string;
  inviteCode: string;
  deadline: string;
  recipients: Array<{
    email: string;
    name: string;
  }>;
}

export interface SendProjectInvitesResult {
  mode: "sent" | "preview";
  deliveries: ProjectInviteDelivery[];
}

interface ApiErrorBody {
  error?: string;
}

export async function sendProjectInvites(
  input: SendProjectInvitesInput,
): Promise<SendProjectInvitesResult> {
  const res = await fetch("/api/notify/invites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(body?.error ?? `Invite email request failed (${res.status})`);
  }
  return (await res.json()) as SendProjectInvitesResult;
}
