import { NextResponse } from "next/server";
import { getProjectByInviteCodeFromSupabase, hasProjectDatabase } from "@/lib/supabase/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!hasProjectDatabase()) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }
    const { code } = await params;
    const project = await getProjectByInviteCodeFromSupabase(decodeURIComponent(code));
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load invite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
