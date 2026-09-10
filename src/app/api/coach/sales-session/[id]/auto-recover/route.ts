import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { recoverSessionTranscript } from "@/lib/coach/v5/transcriptRecovery";

/**
 * POST /api/coach/sales-session/[id]/auto-recover — the ON-OPEN half of transcript recovery.
 *
 * The founder-reported 2026-08-14 failure: a real 6-minute call produced a blank After-Pitch
 * because live STT captured the AGENT side but not the CUSTOMER side. This route recovers
 * such a session WITHOUT a rep tap by re-reading the saved audio offline.
 *
 * WHAT CHANGED, 10 September 2026. The recovery body moved into
 * `@/lib/coach/v5/transcriptRecovery` and this route became its request shell. Two reasons,
 * and the second is the founder-reported one:
 *
 *   1. The SWEEP (`recover-transcripts-cron`) must run the identical recovery. Two copies
 *      of a two-hundred-line procedure drift, and the drift would be silent — one trigger
 *      quietly recovering differently from the other.
 *   2. This route USED TO REFUSE the case that mattered most. Its precondition was the
 *      talk_ratio caveat, and `computeTalkRatio` of an EMPTY transcript returns null, so a
 *      call with saved audio and NO transcript answered "not-applicable" and stopped. Nine
 *      such sessions were sitting in production, none ever attempted. The shared resolver
 *      replaces that precondition with one rule — a transcript missing an entire SIDE is
 *      recoverable, a two-sided one is canonical — which covers blank, unknown-only,
 *      customer-only and the original customer-missing gap alike.
 *
 * The status strings this returns are unchanged, so the After-Pitch page's handling is
 * untouched, with ONE addition: `saved-unlabelled`, when the words were recovered but the
 * system could not confidently say which voice is the rep. The page treats it like every
 * other non-recovered terminal and offers the one-tap card — which is exactly right: the
 * transcript is already safe, and the tap only labels it.
 *
 * OWNER-ONLY (A18), matching /label-transcript: this WRITES the canonical transcript via
 * the service role, so a colleague must not trigger it on another rep's record.
 */

// Batch diarization of a full recording runs well past a minute.
export const maxDuration = 300;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "sales-session-auto-recover", windowMs: 60_000, max: 3 });
  if (limited) return limited;

  const { id } = await context.params;
  // A mobile caller sends a Bearer token and NO cookie, so a bare cookie client would read
  // as anonymous and 404 a session that exists. Read through the caller's own client and
  // let RLS decide, exactly as it already does elsewhere.
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await db.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = await callerCompanyId(db, auth.user.id);
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const session = await getSession(id, db);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's rep can recover its transcript." },
      { status: 403 }
    );
  }

  const result = await recoverSessionTranscript({
    sessionId: id,
    companyId,
    actorId: auth.user.id,
    db,
  });

  switch (result.status) {
    case "recovered":
      return NextResponse.json({
        status: "recovered",
        appended: result.appended,
        source: result.source,
      });
    case "saved-unlabelled":
      // The words are SAVED. The rep is asked only to say whose voice is whose, and the
      // existing one-tap card is what asks. Never a failure, and never silent.
      return NextResponse.json({
        status: "saved-unlabelled",
        appended: result.appended,
        reason: result.reason,
      });
    case "still-one-sided":
      // Preserve the original two-way split: a genuine single-voice recording is a terminal
      // ("the audio holds one voice"), while ambiguous/no-signal can still be tapped by hand.
      return NextResponse.json(
        result.reason === "single-cluster"
          ? { status: "still-one-sided", reason: result.reason }
          : { status: "could-not-decide", reason: result.reason }
      );
    case "canonical":
      return NextResponse.json({ status: "canonical" }, { status: 409 });
    case "no-audio":
      return NextResponse.json(
        { status: "no-audio", error: "No saved recording for this session to recover." },
        { status: 409 }
      );
    case "already-attempted":
      return NextResponse.json({ status: "already-attempted" });
    case "failed":
      // The three codes are NOT interchangeable and the route test pins them: 502 for an
      // upstream outage (storage / speech-to-text — theirs, and worth retrying), 500 for
      // our own database write, 422 for a request that can never succeed as posed. The
      // audio is safe in every one of them, which is what `audioSaved` says.
      return NextResponse.json(
        { status: "failed", audioSaved: true, error: result.error },
        { status: result.where === "upstream" ? 502 : result.where === "internal" ? 500 : 422 }
      );
  }
}
