import { NextResponse } from "next/server";
import { hasProjectDatabase, registerContributorInSupabase } from "@/lib/supabase/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterBody {
  inviteCode: string;
  userId: string;
  displayName: string;
  email: string;
  walletAddress: string;
  ffePublicKey: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasProjectDatabase()) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }
    const { id } = await params;
    const body = (await request.json()) as RegisterBody;
    if (!body.inviteCode || !body.userId || !body.walletAddress || !body.ffePublicKey) {
      return NextResponse.json(
        { error: "Invite code, user, wallet, and public key are required." },
        { status: 400 },
      );
    }
    const project = await registerContributorInSupabase({
      projectId: id,
      inviteCode: body.inviteCode,
      userId: body.userId,
      displayName: body.displayName,
      email: body.email,
      walletAddress: body.walletAddress,
      ffePublicKey: body.ffePublicKey,
    });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not register contributor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
