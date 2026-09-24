import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { scoreSession, type ScoreRefusal } from "@/lib/coach/pitchScore/scoreSession";
import { readPitchScore } from "@/lib/coach/pitchScore/readPitchScore";

/**
 * POST /api/coach/sales-session/pitch-score  { sessionId }
 *
 * Grades one recorded pitch against the AT&T Fiber rubric and stores the score with its evidence.
 * GET ?sessionId=… reads back the stored score.
 *
 * This is the trigger Project 1 was missing: the engine and the writer both existed and nothing
 * called them, so 4,497 green tests described a system that had never scored a real pitch.
 *
 * FOUR THINGS THIS ROUTE MUST GET RIGHT, each of which would otherwise be silent:
 *
 * 1. The score belongs to the REP, not the caller. A manager scoring a rep's recording must write
 *    `rep_id = session.agentId`. Using `auth.user.id` would file every manager-triggered score
 *    against the manager, quietly inflating their leaderboard and emptying the rep's.
 *
 * 2. `recorded_at` is the RECORDING's time, not now(). An upload processed days later has a
 *    wall-clock that is nowhere near its own audio — this product has already shipped that bug
 *    once ("a call recorded on the 4th was filed as happening on the 11th"), and a leaderboard
 *    filtered by week would put the pitch in the wrong week.
 *
 * 3. Not every session is a pitch. `session_kind` is 'sales' | 'meeting' | 'huddle' (0237), and
 *    grading a team huddle against a door-to-door rubric produces a real-looking low score for a
 *    conversation that was never a pitch. Refused, with a reason.
 *
 * 4. The outcome vocabularies DIFFER. SalesOutcome has five values; `pitches.outcome` allows
 *    three. Passing 'no_contact' straight through violates the CHECK and fails the entire write
 *    AFTER the LLM call has been paid for — so it is mapped, not forwarded.
 *
 * Bearer-reachable from the start (F22/F33): reps are on phones, which send a token and no
 * cookies. The scoped client is passed THROUGH to both reads, not merely used for auth — scoped
 * for identity and anonymous for the read is the shape that has cost this codebase five defects.
 */
const BodySchema = z.object({ sessionId: z.string().uuid() });

/**
 * HTTP status per refusal. Not one code for all of them: 404 and 409 are about the REQUEST, 422 is
 * about the recording, 409-on-suppressed is about the ACCOUNT, and 502 is us. A client that gets
 * 502 offers a retry; one that gets 422 must not.
 */
const STATUS_FOR: Record<ScoreRefusal, number> = {
  not_found: 404,
  not_a_sales_call: 409,
  no_agent_turns: 422,
  /**
   * 502, PRESERVED FROM THE OLD INLINE TERNARY, not because it is the best code for it.
   *
   * Guidance being off is an account state, not an upstream fault, so a 409 would describe it
   * better and would stop these showing up in error monitoring as failed dependencies. That is a
   * behaviour change nobody asked for, in a build about reachability, and the existing test
   * asserts 502 on purpose — so it is recorded as an observation rather than taken quietly.
   */
  suppressed: 502,
  llm_empty: 502,
  parse_failed: 502,
  store_failed: 500,
};

// LLM route: a full grading is ~30 elements plus events, so it needs more than Vercel's default.
export const maxDuration = 60;



export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pitch-score", windowMs: 60_000, max: 12 });
  if (limited) return limited;

  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = await callerCompanyId(supabase, auth.user.id);
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  /**
   * ONE authority, consumed as a verdict (§2.2).
   *
   * This route used to hold the whole sequence inline — session read, kind check, transcript,
   * grading, store, detection. It is now one of THREE callers (this button, the session-close
   * path, the backlog drain), and three inline copies of "can this be scored?" is the duplicated
   * condition that drifts: one gains a term, the others do not, and a caller either scores
   * something it should have refused or throws away a result it has already paid for.
   */
  const outcome = await scoreSession({
    sessionId: body.sessionId,
    companyId,
    db: supabase,
    // A manager pressing Score again means score it again. Only the unattended callers skip.
    skipIfScored: false,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      // The authority's own sentence — see scoreSession's note on why this is not rebuilt here.
      { error: outcome.humanMessage, failure: outcome.reason },
      { status: STATUS_FOR[outcome.reason] }
    );
  }

  return NextResponse.json({
    pitchId: outcome.pitchId,
    score: outcome.score,
    timestampsUnavailable: outcome.timestampsUnavailable,
  });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Same owner-or-manager gate as POST, and for the same reason: `pitches` RLS lets a manager read
  // the whole company, so gating on the pitch row alone would be weaker than gating on the session.
  const session = await getSession(sessionId, supabase);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }

  // Read through the CALLER's client, so the RLS that IS this gate applies to the caller.
  const pitch = await readPitchScore(sessionId, supabase);
  return NextResponse.json({ pitch });
}

/**
 * The pitch's length in whole seconds.
 *
 * Prefers the real audio length captured from the transcription word timestamps (0210), because
 * for an UPLOADED recording the started..ended wall-clock is when the file was processed, not how
 * long the conversation was. Falls back to wall-clock, which is correct for live coaching.
 */

