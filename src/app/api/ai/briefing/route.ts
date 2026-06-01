import { NextRequest, NextResponse } from "next/server";
import { generateDailyQuestions } from "@/lib/claude";

/**
 * "Today's open questions" route — replaces the old "daily briefing" overtake
 * (CLAUDE.md §3.3). Returns the data the executive should be holding open today,
 * not actions the System recommends.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const context = JSON.stringify(body, null, 2);
    const raw = await generateDailyQuestions(context);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
