import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { dissectCoachV5 } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { buildCallScenarioSystemPrompt, buildCallScenarioUserMessage, parseCallScenarioDraft } from "@/lib/coach/v5/practiceScenario";

/**
 * POST /api/coach/remote/scenarios/draft { sessionId } — a DRAFT practice scenario from a real phone/video call
 * (2026-11-25; ledger F17.3). Managers only, for a call they may open (getSession under their own client: RLS and the
 * reporting tree decide), a finished sales call. Nothing is saved: the manager reviews and edits the draft in the
 * scenario form, which saves through POST /api/coach/remote/scenarios linked to the call (so erasure retires it, 0317).
 * The draft holds no personal details (prompt + stripPersonalDetails). Sales Coach AI runs from day 1 (the recorded
 * decision every sales engine follows: dissectCoachV5 is controlExempt), so drafting isn't held back in a company's
 * control month; `suppressed` is still consumed as the verdict (§2.2) in case that ever changes.
 */
export const maxDuration = 60;
const Body = z.object({ sessionId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenario-draft", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Only a manager can build practice scenarios." }, { status: 403 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(body.sessionId, db);
  if (!session || session.companyId !== mgr.companyId) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(session.context) || !isSalesCall(session.sessionKind)) {
    return NextResponse.json({ error: "Only a phone or video sales call can become a practice scenario." }, { status: 409 });
  }
  if (session.status === "active") return NextResponse.json({ error: "This call is still live." }, { status: 409 });

  const { data: segs, error } = await db
    .from("coaching_transcript_segments_current")
    .select("speaker, text, seq")
    .eq("session_id", session.id)
    .order("seq", { ascending: true });
  if (error) {
    console.error(`[scenario-draft] transcript read failed session=${session.id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read the call's transcript." }, { status: 500 });
  }
  const lines = ((segs ?? []) as Array<{ speaker: string; text: string }>).map((s) => ({
    speaker: (s.speaker === "agent" || s.speaker === "customer" ? s.speaker : "unknown") as "agent" | "customer" | "unknown",
    text: s.text,
  }));
  if (!lines.some((l) => l.speaker === "customer")) {
    return NextResponse.json({ error: "This call has no customer lines to build from. Write the scenario by hand." }, { status: 409 });
  }

  const r = await dissectCoachV5({
    companyId: mgr.companyId,
    systemPrompt: buildCallScenarioSystemPrompt() + CONVERSATION_IS_DATA,
    userMessage: buildCallScenarioUserMessage(lines),
    engine: "rss_scenario_draft",
    sessionId: session.id,
  });
  if (r.suppressed) {
    return NextResponse.json({ draft: null, reason: "AI guidance is off for your company right now, so write this one by hand." });
  }
  const draft = parseCallScenarioDraft(r.text);
  return NextResponse.json(draft ? { draft } : { draft: null, reason: "Couldn't draft one from this call. Write it by hand, or try again." });
}
