import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { scoreSession, type ScoreRefusal } from "@/lib/coach/pitchScore/scoreSession";
import { readPitchScore, PitchScoreReadError } from "@/lib/coach/pitchScore/readPitchScore";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { archivePitchScore } from "@/lib/coach/pitchScore/scoreHistory";
import { resolveScoreRequest, RescoreRefused } from "@/lib/coach/remote/rescore";
import { recordAudit } from "@/lib/audit/recordAudit";

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
/**
 * `reason` is required for a RE-score (RSS Phase 0 step 5, D3) and ignored for a first score. Capped so the
 * archive row stays a sentence, not a document.
 */
const BodySchema = z.object({ sessionId: z.string().uuid(), reason: z.string().max(500).optional() });

/**
 * HTTP status per refusal. Not one code for all of them: 404 and 409 are about the REQUEST, 422 is
 * about the recording, 409-on-suppressed is about the ACCOUNT, and 502 is us. A client that gets
 * 502 offers a retry; one that gets 422 must not.
 */
const STATUS_FOR: Record<ScoreRefusal, number> = {
  not_found: 404,
  not_a_sales_call: 409,
  no_agent_turns: 422,
  too_little_rep_speech: 422, // D5: about the recording; a retry won't change it
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
  /** The scorer backed no grade with evidence — ours, and a retry asks the model again. Same as parse_failed. */
  no_evidence: 502,
  /** Something threw inside the scorer. Ours, and worth a retry — same shape as llm_empty. */
  errored: 502,
  // Billing, not a bad request: the provider is unavailable to us until the account is topped up.
  provider_out_of_credit: 503,
  // The provider is not answering: unavailable to us for now, and a retry later is the right move.
  provider_down: 503,
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

  // The rep the score belongs to, and whether the session is visible to the caller at all. getSession is
  // RLS-scoped (owner or manager), so a peer rep gets the same 404 scoreSession would give.
  const session = await getSession(body.sessionId, supabase);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }

  // Already scored? Read through the caller's client. A failed read must not be taken as "not scored":
  // that would run a paid grading over a stored score with no archive and no reason.
  const { data: existing, error: existingErr } = await supabase
    .from("pitch_scores")
    .select("id")
    .eq("session_id", body.sessionId)
    .maybeSingle();
  if (existingErr) {
    console.error(`[pitch-score] existing-score read failed session=${body.sessionId}: ${existingErr.message}`);
    return NextResponse.json({ error: "Couldn't check whether this pitch is already scored." }, { status: 500 });
  }

  /**
   * RE-SCORE RULE (RSS Phase 0 step 5; Gong F15.15; D3 decided 2026-11-15).
   *
   * Until this change the route passed skipIfScored:false for EVERY caller, so a rep could re-score their own
   * pitch through the API (the UI only hid the button) and the store replaced the score and deleted its
   * evidence (0254:117). Now: resolveScoreRequest decides — a first score always runs; a re-score needs a
   * manager of the rep and a reason; the old version is archived first.
   *
   * "Manager of the rep" is today's rule — a Sales Coach manager of the same company, the
   * requireSalesCoachManager verdict (§2.2) — and never the rep themselves, so a manager cannot re-score
   * their own pitch either. The reporting tree (Phase 0 step 8, migration 0273) needs no term here: getSession
   * above reads through the caller's RLS, which, once the company is on the tree, hides a session from a
   * manager outside the rep's chain — so such a manager is answered 404 before reaching this line.
   */
  const manager = await requireSalesCoachManager(req);
  const isManagerOfRep = !!manager && manager.companyId === companyId && manager.userId !== session.agentId;

  let decision: { skipIfScored: boolean; archiveFirst: boolean };
  try {
    decision = resolveScoreRequest({
      caller: { id: auth.user.id, isManagerOfRep },
      repId: session.agentId,
      alreadyScored: !!existing?.id,
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  } catch (err) {
    if (!(err instanceof RescoreRefused)) throw err;
    const isOwner = auth.user.id === session.agentId;
    return NextResponse.json(
      // A rep is pointed at the dispute, which is the existing way to contest a grade.
      { error: err.message, failure: "rescore_refused", ...(isOwner ? { hint: "dispute" } : {}) },
      { status: 403 }
    );
  }

  // D3: keep the old version. Nothing is re-scored unless the copy landed.
  let earlierOverrides: number | null = null;
  if (decision.archiveFirst && existing?.id) {
    const archived = await archivePitchScore(createAdminClient(), {
      pitchId: String(existing.id),
      companyId,
      archivedBy: auth.user.id,
      reason: body.reason ?? "",
    });
    if (!archived.ok) {
      const [status, error] =
        archived.cause === "not_applied"
          ? [503, "Re-scoring is waiting on database migration 0272, so the current score can't be kept first. Nothing was changed."]
          : archived.cause === "not_found"
            ? [404, "This pitch's score was not found."]
            : [500, "Couldn't keep a copy of the current score, so it was not re-scored. Nothing was changed."];
      return NextResponse.json({ error, failure: "archive_failed" }, { status });
    }
    earlierOverrides = archived.earlierOverrides;
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
    skipIfScored: decision.skipIfScored,
    ...(decision.archiveFirst ? { rescoredBy: auth.user.id } : {}),
  });

  if (!outcome.ok) {
    return NextResponse.json(
      // The authority's own sentence — see scoreSession's note on why this is not rebuilt here.
      { error: outcome.humanMessage, failure: outcome.reason },
      { status: STATUS_FOR[outcome.reason] }
    );
  }

  if (decision.archiveFirst) {
    await recordAudit(createAdminClient(), {
      companyId,
      actorId: auth.user.id,
      action: "score.rescore",
      objectType: "coaching_session",
      objectId: body.sessionId,
      meta: { pitchId: outcome.pitchId, score: outcome.score, reason: body.reason ?? "", earlierOverrides },
    });
  }

  return NextResponse.json({
    pitchId: outcome.pitchId,
    score: outcome.score,
    timestampsUnavailable: outcome.timestampsUnavailable,
    rescored: decision.archiveFirst,
    // D3: earlier manager overrides are NOT re-applied to the new grading. The count is handed back so the
    // manager sees there are some to review, rather than finding out from a total that no longer matches.
    ...(earlierOverrides !== null ? { earlierOverrides } : {}),
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
  // A failed read is a 500, never `{ pitch: null }`: the panel reads null as "Not scored yet" and offers a paid
  // re-score of a pitch that may already be scored (2026-10-08, PitchScoreReadError).
  try {
    const pitch = await readPitchScore(sessionId, supabase);
    return NextResponse.json({ pitch });
  } catch (err) {
    if (!(err instanceof PitchScoreReadError)) throw err;
    return NextResponse.json({ error: "Couldn't read this pitch's score right now." }, { status: 500 });
  }
}

/**
 * The pitch's length in whole seconds.
 *
 * Prefers the real audio length captured from the transcription word timestamps (0210), because
 * for an UPLOADED recording the started..ended wall-clock is when the file was processed, not how
 * long the conversation was. Falls back to wall-clock, which is correct for live coaching.
 */

