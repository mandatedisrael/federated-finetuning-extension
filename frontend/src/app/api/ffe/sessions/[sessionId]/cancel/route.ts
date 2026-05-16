import { NextResponse } from "next/server";
import { requestSessionCancellation } from "@/lib/ffe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const result = await requestSessionCancellation({
      sessionId,
      reason: body.reason,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel FFE session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
