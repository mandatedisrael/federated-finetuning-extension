import { NextResponse } from "next/server";
import { prepareContribution } from "@/lib/ffe/server";
import type { PrepareFfeContributionInput } from "@/lib/ffe/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as PrepareFfeContributionInput;
    const result = await prepareContribution(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to prepare contribution.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
