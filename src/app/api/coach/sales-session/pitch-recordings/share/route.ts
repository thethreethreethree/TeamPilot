import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { notifyRecordingEvent } from "@/lib/coach/recordings/notifyRecording";

/**
 * POST /api/coach/sales-session/pitch-recordings/share — guide Step 4, item 7.
 *
 *     "Save as team example" needs the rep's permission before other reps can hear it.
 *
 * TWO CALLERS, TWO PATHS, AND THEY ARE NOT THE SAME ROUTE WEARING A PARAMETER. A manager may only
 * ASK, and a rep may only ANSWER. The split is in the database (0260's two policies) and it is
 * mirrored here rather than replaced by a role check, because a route is one deploy away from
 * being the only thing between a manager and a recording of somebody else.
 *
 * The ask is written with the service role — `requested` has no insert policy, for the same
 * reason `recording_comments` has none: a client-authored request would forge the asking half
 * too. The answer is written through the CALLER'S client, so 0260's `actor_id = auth.uid() and
 * p.rep_id = auth.uid()` policy is what makes the rep's yes actually the rep's.
 *
 * Nothing here decides whether the clip may play. That verdict is `shareState()` replaying the
 * log, consumed by the GET route and the surface (§2.2).
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pitch-recording-share", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { pitchId?: unknown; kind?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const pitchId = typeof body.pitchId === "string" ? body.pitchId : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  if (!pitchId) return NextResponse.json({ error: "Which recording?" }, { status: 400 });

  // ── The rep answering ──────────────────────────────────────────────────────────────────────
  if (kind === "granted" || kind === "declined" || kind === "revoked") {
    const supabase = callerScopedDb(req) ?? (await createClient());
    const { error } = await supabase.from("recording_share_events").insert({
      company_id: ctx.companyId,
      pitch_id: pitchId,
      actor_id: ctx.userId,
      kind,
      note,
    });
    if (error) {
      // The policy is what rejected it — the caller is not the rep whose pitch this is. Logged
      // with its detail, answered without it (CWE-209).
      console.error(
        `[recording-share] answer rejected pitch=${pitchId} actor=${ctx.userId} kind=${kind}: ${error.message}`
      );
      return NextResponse.json({ error: "That is not yours to answer." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, kind });
  }

  // ── The manager asking ─────────────────────────────────────────────────────────────────────
  if (kind !== "requested") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const manager = await requireSalesCoachManager(req);
  if (!manager) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const admin = createAdminClient();
  const { data: pitch } = await admin
    .from("pitch_scores")
    .select("id, company_id, rep_id, session_id")
    .eq("id", pitchId)
    .maybeSingle();

  // Service-role insert, so the company check is carried here rather than by a policy.
  if (!pitch || pitch.company_id !== manager.companyId) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }
  if (String(pitch.rep_id) === manager.userId) {
    // A manager's own pitch needs no permission from anyone else, and a self-addressed request
    // would sit unanswered in their own bell forever.
    return NextResponse.json({ error: "This is your own recording." }, { status: 400 });
  }

  const { error } = await admin.from("recording_share_events").insert({
    company_id: manager.companyId,
    pitch_id: pitchId,
    actor_id: manager.userId,
    kind: "requested",
    note,
  });
  if (error) {
    console.error(`[recording-share] request failed pitch=${pitchId}: ${error.message}`);
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }

  // The rep has to be told, or the request is a row nobody will ever answer.
  const notified = await notifyRecordingEvent({
    companyId: manager.companyId,
    repId: String(pitch.rep_id),
    sessionId: (pitch.session_id as string | null) ?? null,
    type: "recording_share_requested",
    payload: { pitch_id: pitchId, ...(note ? { note } : {}) },
  });

  return NextResponse.json({ ok: true, kind: "requested", notified });
}
