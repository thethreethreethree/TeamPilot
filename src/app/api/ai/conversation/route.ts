import { NextRequest, NextResponse } from "next/server";
import { analyzeConversation } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { conversation } = await req.json();
    const raw = await analyzeConversation(conversation);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
