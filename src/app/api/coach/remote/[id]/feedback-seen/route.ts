import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/remote/:id/feedback-seen — the call's own rep saw the answer to their feedback request (2026-11-23,
 * migration 0321). Sent by the call page when it shows "Answered". "Your coaching this week" then stops listing that
 * answer. Through the CALLER's client: 0321's insert policy is the gate (own call, own company); checked here too for
 * a clear 403. Append-only. Best-effort for the page: a failure only means the answer stays listed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "feedback-seen", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (session.agentId !== ctx.userId) return NextResponse.json({ error: "Only the call's rep." }, { status: 403 });
  const { error } = await db.from("feedback_answer_views").insert({ company_id: session.companyId, session_id: id, rep_id: ctx.userId });
  if (error) {
    console.error(`[feedback-seen] insert failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't record that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
