import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getSession,
  saveAfterPitchSummary,
  getLatestAfterPitchSummary,
} from "@/lib/data/salesCoach";
import { generateAfterPitchSummary } from "@/lib/coach/v5/afterPitch";

/**
 * After Pitch Summary — the rep's private "between doors" debrief.
 *
 *   POST /api/coach/sales-session/[id]/after-pitch  → generate + store
 *   GET  /api/coach/sales-session/[id]/after-pitch  → read back latest
 *
 * PRIVACY (A18, founder 2026-07-02 — scores are self-assessment): this
 * summary is the OWNING REP's alone. Both verbs require the caller to BE the
 * session's agent (session.agentId === auth.uid), enforced here AND by the
 * owner-only RLS on after_pitch_summaries (0080). A manager cannot generate or
 * read another rep's private scoreboard.
 *
 * Composition (A16/A21): the assembler REUSES the existing growth-review; this
 * route stores the rep-private artifact and, separately, emits a company-
 * visible event carrying ONLY coarse counts (never the scores) so §3.6
 * learning-visibility works without leaking the private numbers.
 */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-after-pitch",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  // Private-to-owner: only the rep gets their own After Pitch Summary.
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "This summary is private to the rep." },
      { status: 403 }
    );
  }

  const summary = await generateAfterPitchSummary({
    companyId: session.companyId,
    sessionId: id,
    context: session.context,
    outcome: session.outcome,
  });

  if (summary.hasSignal) {
    // Store the rep-private artifact (RLS owner-only). Best-effort — the
    // summary still returns even if the store fails.
    await saveAfterPitchSummary({
      sessionId: id,
      companyId: session.companyId,
      agentId: auth.user.id,
      payload: summary,
    });
    // Company-visible event — COARSE COUNTS ONLY, never the private scores
    // (§3.6 make-learning-visible without breaking A18 privacy). Best-effort.
    try {
      const breakdown = summary.moments.some((m) => m.isBreakdown);
      await supabase.from("events").insert({
        company_id: session.companyId,
        actor: auth.user.id,
        kind: "coach.after_pitch_summary_generated",
        subject: `sales_session:${id}`,
        payload: {
          moments_count: summary.moments.length,
          has_breakdown: breakdown,
          cue_loop_count: summary.cueLoop.length,
          focus_present: summary.focus !== null,
          coach_version: "after-pitch-v1",
        },
      });
    } catch {
      /* event emit is best-effort; the summary still returns */
    }
  }

  return NextResponse.json({ summary });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // getLatestAfterPitchSummary reads via the RLS user client — a non-owner
  // gets null by policy, which is the privacy contract.
  const summary = await getLatestAfterPitchSummary(id);
  return NextResponse.json({ summary: summary ?? null });
}
