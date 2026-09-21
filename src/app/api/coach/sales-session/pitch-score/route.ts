import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { generatePitchScore } from "@/lib/coach/pitchScore/generatePitchScore";
import { storePitchScore } from "@/lib/coach/pitchScore/storePitchScore";
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

// LLM route: a full grading is ~30 elements plus events, so it needs more than Vercel's default.
export const maxDuration = 60;

/** Why a scoring run produced no score. Each maps to a different thing to tell the user. */
const FAILURE_MESSAGE: Record<string, string> = {
  no_agent_turns: "This recording has no rep speech to grade.",
  suppressed: "AI guidance is off for this account, so pitches are not scored yet.",
  llm_empty: "The scorer returned nothing. This is a fault on our side, not your pitch.",
  parse_failed: "The scorer's answer could not be read. This is a fault on our side.",
};

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

  // RLS scopes this to owner-or-manager (0083/0084). A null result is the IDOR gate: a same-company
  // PEER rep must not be able to score — or read — another rep's recording.
  const session = await getSession(body.sessionId, supabase);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }

  // (3) A huddle is not a pitch. Refused with a reason rather than scored low, because a score is
  // a claim about how someone sold and this conversation was never a sale.
  if (session.sessionKind !== "sales") {
    return NextResponse.json(
      { error: `Only sales calls are scored against the pitch rubric (this is a ${session.sessionKind}).` },
      { status: 409 }
    );
  }

  const segments = await getSessionTranscript(body.sessionId, supabase);

  const result = await generatePitchScore({
    companyId,
    sessionTitle: session.clientLabel ?? undefined,
    segments,
  });

  // No zero-score failure path. Every one of these is reported as a failure, never stored — the
  // whole reason generatePitchScore returns a discriminated union is that a blank LLM answer must
  // not become a real-looking 0 on a rep's leaderboard with nothing in the logs.
  if (!result.ok) {
    return NextResponse.json(
      { error: FAILURE_MESSAGE[result.failure] ?? "The pitch could not be scored.", failure: result.failure },
      { status: result.failure === "no_agent_turns" ? 422 : 502 }
    );
  }

  const pitchId = await storePitchScore({
    companyId,
    // (1) The rep who gave the pitch, never the caller who asked for it scored.
    repId: session.agentId,
    // (2) The recording's own time.
    recordedAt: session.startedAt,
    sessionId: session.id,
    durationS: sessionDurationS(session),
    audioUrl: session.audioAssetUrl,
    // (4) Mapped, not forwarded — 'no_contact' and 'undecided' have no column value.
    outcome: pitchOutcome(session.outcome),
    result,
  });

  if (!pitchId) {
    // storePitchScore has already logged the detail server-side (CWE-209). The caller gets the
    // fact, not the constraint text.
    return NextResponse.json({ error: "The score could not be saved." }, { status: 500 });
  }

  return NextResponse.json({
    pitchId,
    score: result.score,
    timestampsUnavailable: result.timestampsUnavailable,
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
function sessionDurationS(session: {
  audioDurationSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
}): number | null {
  if (session.audioDurationSeconds != null) return session.audioDurationSeconds;
  if (!session.endedAt) return null;
  const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null;
}

/**
 * Map a SalesOutcome onto the three values `pitches.outcome` accepts.
 *
 * `no_contact` and `undecided` become null rather than being forced into one of the three. A door
 * that was never answered is not a "no_sale" — recording it as one would make the sold-rate a lie,
 * and the sold-rate is one of the two hard metrics the whole product is measured on (§3.5).
 */
function pitchOutcome(outcome: string | null): "sold" | "follow_up" | "no_sale" | null {
  return outcome === "sold" || outcome === "follow_up" || outcome === "no_sale" ? outcome : null;
}
