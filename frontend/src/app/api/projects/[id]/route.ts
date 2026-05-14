import { NextResponse } from "next/server";
import {
  getProjectFromSupabase,
  hasProjectDatabase,
  updateProjectInSupabase,
} from "@/lib/supabase/projects";
import type { Project } from "@/lib/mock/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasProjectDatabase()) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }
    const { id } = await params;
    const project = await getProjectFromSupabase(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasProjectDatabase()) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }
    const { id } = await params;
    const patch = (await request.json()) as Partial<Project>;
    const project = await updateProjectInSupabase(id, patch);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
