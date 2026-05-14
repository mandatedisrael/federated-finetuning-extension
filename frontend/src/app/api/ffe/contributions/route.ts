import { NextResponse } from "next/server";
import { submitProxyContribution } from "@/lib/ffe/server";
import type { SubmitFfeContributionInput } from "@/lib/ffe/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as SubmitFfeContributionInput;
    const result = await submitProxyContribution(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit contribution.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
