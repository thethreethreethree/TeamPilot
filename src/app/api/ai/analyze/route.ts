import { NextRequest, NextResponse } from "next/server";
import { analyzeOperations } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = await analyzeOperations(JSON.stringify(body, null, 2));
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, diagnosis: message }, { status: 500 });
  }
}
