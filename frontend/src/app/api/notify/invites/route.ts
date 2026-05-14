import { NextResponse } from "next/server";
import { sendInviteEmails } from "@/lib/notify/sendInviteEmails";
import type { SendProjectInvitesInput } from "@/lib/notify/inviteDelivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as SendProjectInvitesInput;
    if (!input.projectId || !input.projectName || !input.inviteCode) {
      return NextResponse.json(
        { error: "Project id, name, and invite code are required." },
        { status: 400 },
      );
    }
    const result = await sendInviteEmails(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send invite emails.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
