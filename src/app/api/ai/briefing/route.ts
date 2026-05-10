import { NextRequest, NextResponse } from "next/server";
import { generateDailyBriefing } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const context = JSON.stringify(body, null, 2);
    const briefing = await generateDailyBriefing(context);
    return NextResponse.json({ briefing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
