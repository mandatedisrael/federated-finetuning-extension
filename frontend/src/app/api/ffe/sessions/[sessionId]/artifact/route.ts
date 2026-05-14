import { NextResponse } from "next/server";
import { downloadArtifact } from "@/lib/ffe/server";
import type { DownloadFfeArtifactInput } from "@/lib/ffe/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const input = (await request.json()) as DownloadFfeArtifactInput;
    const result = await downloadArtifact({ sessionId, ...input });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to download FFE artifact.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
