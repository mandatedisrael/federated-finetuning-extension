import { NextResponse } from "next/server";
import { getSessionStatus } from "@/lib/ffe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const result = await getSessionStatus(sessionId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load FFE session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
