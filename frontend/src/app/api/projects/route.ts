import { NextResponse } from "next/server";
import { hasProjectDatabase, saveProjectToSupabase } from "@/lib/supabase/projects";
import type { Project } from "@/lib/mock/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!hasProjectDatabase()) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }
    const project = (await request.json()) as Project;
    if (!project.id || !project.inviteCode || project.contributors.length === 0) {
      return NextResponse.json({ error: "A complete project draft is required." }, { status: 400 });
    }
    const saved = await saveProjectToSupabase(project);
    return NextResponse.json({ project: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
