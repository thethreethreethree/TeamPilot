import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { remoteStage } from "@/lib/coach/remote/session/stage";
import { FAILURE_LABEL, STAGE_CHIPS, type SessionFailureCode } from "@/lib/coach/remote/session/state";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";

/**
 * GET /api/coach/sales-session/:id/stage — where a phone/video session is in processing (RSS Phase 1, F6.6).
 *
 * Everything is read through the CALLER's client: getSession is RLS-scoped (owner, or a manager of the rep under
 * the 0273 reporting tree), and so are the transcript, analysis, score and failure reads. Bearer-reachable.
 *
 * A door session, or a meeting/huddle, answers `{ remote: false }`: the Door Log has its own processing states
 * (D1), and a meeting is not a sales session.
 * Before 0275 the failures table does not exist; that read is treated as "no failure recorded".
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "sales-session-stage", windowMs: 60_000, max: 240 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  // A remote SALES session only: a video meeting or huddle is not one (isSalesCall, the one verdict).
  if (!isRemoteContext(session.context) || !isSalesCall(session.sessionKind)) return NextResponse.json({ remote: false });

  const [segs, analysis, score, failures] = await Promise.all([
    db.from("coaching_transcript_segments_current").select("id", { count: "exact", head: true }).eq("session_id", id),
    db.from("after_pitch_summaries").select("session_id").eq("session_id", id).limit(1),
    db.from("pitch_scores").select("id").eq("session_id", id).limit(1),
    db.from("session_failures").select("reason_code").eq("session_id", id).order("created_at", { ascending: false }).limit(1),
  ]);
  const readErr = segs.error ?? analysis.error ?? score.error;
  if (readErr) {
    console.error(`[sales-session/stage] read failed session=${id}: ${readErr.message}`);
    return NextResponse.json({ error: "Couldn't read this session's progress." }, { status: 500 });
  }

  const failure = failures.error ? null : ((failures.data?.[0]?.reason_code as SessionFailureCode | undefined) ?? null);
  const stage = remoteStage({
    status: session.status,
    hasAudio: !!session.audioAssetUrl,
    segmentCount: segs.count ?? 0,
    hasAnalysis: (analysis.data?.length ?? 0) > 0,
    scored: (score.data?.length ?? 0) > 0,
    failure,
  });

  return NextResponse.json({
    remote: true,
    state: stage.state,
    failure: stage.failure ? { code: stage.failure, label: FAILURE_LABEL[stage.failure] } : null,
    chips: STAGE_CHIPS,
  });
}
