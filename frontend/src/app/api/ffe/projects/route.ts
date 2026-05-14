import { NextResponse } from "next/server";
import { createProxySession } from "@/lib/ffe/server";
import type { CreateFfeProjectSessionInput } from "@/lib/ffe/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateFfeProjectSessionInput;
    const result = await createProxySession(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create FFE session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
