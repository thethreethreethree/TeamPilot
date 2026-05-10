import { NextRequest, NextResponse } from "next/server";
import { generateDecisionOptions } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { situation } = await req.json();
    const raw = await generateDecisionOptions(situation);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
