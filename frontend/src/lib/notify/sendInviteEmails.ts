import { renderEmail } from "./emailTemplates";
import type { ProjectInviteDelivery } from "@/lib/mock/types";
import type { SendProjectInvitesInput, SendProjectInvitesResult } from "./inviteDelivery";

interface ResendResponse {
  id?: string;
  message?: string;
  error?: { message?: string };
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function now() {
  return new Date().toISOString();
}

async function sendOne(input: SendProjectInvitesInput, recipient: { email: string; name: string }) {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM") ?? env("RESEND_FROM_EMAIL");
  const replyTo = env("EMAIL_REPLY_TO");
  const rendered = renderEmail("invite", {
    projectId: input.projectId,
    projectName: input.projectName,
    recipientName: recipient.name,
    ownerName: input.ownerName,
    origin: input.origin,
    inviteCode: input.inviteCode,
    deadline: input.deadline,
  });

  if (!apiKey || !from) {
    return {
      recipient: recipient.email,
      status: "preview",
      sentAt: now(),
    } satisfies ProjectInviteDelivery;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient.email],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const body = (await res.json().catch(() => null)) as ResendResponse | null;
  if (!res.ok) {
    return {
      recipient: recipient.email,
      status: "failed",
      error: body?.error?.message ?? body?.message ?? `Resend returned ${res.status}`,
      sentAt: now(),
    } satisfies ProjectInviteDelivery;
  }

  return {
    recipient: recipient.email,
    status: "sent",
    messageId: body?.id,
    sentAt: now(),
  } satisfies ProjectInviteDelivery;
}

export async function sendInviteEmails(
  input: SendProjectInvitesInput,
): Promise<SendProjectInvitesResult> {
  const recipients = input.recipients.filter((recipient) => isEmail(recipient.email));
  const deliveries = await Promise.all(recipients.map((recipient) => sendOne(input, recipient)));
  const mode = deliveries.some((delivery) => delivery.status === "sent") ? "sent" : "preview";
  return { mode, deliveries };
}
