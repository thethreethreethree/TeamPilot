import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { notifyRecordingEvent } from "@/lib/coach/recordings/notifyRecording";

/**
 * POST /api/coach/sales-session/pitch-recordings/comment — guide Step 4, item 6.
 *
 *     "Save and send to rep" notifies the rep and shows the comment in their Pitch detail.
 *
 * Two buttons, ONE row, and `sent_to_rep` is the difference. A draft the manager keeps and a
 * comment the rep has read are different facts (0259's header), so the flag is set at insert and
 * never updated — a correction is a new comment.
 *
 * SERVER-SIDE AUTHORSHIP. `recording_comments` has no insert policy at all; this route is the only
 * writer, and it stamps `author_id` from the session rather than the body. A client-supplied
 * author is a manager's name on somebody else's words.
 *
 * THE COMPANY CHECK IS NOT OPTIONAL HERE. The insert runs with the service role, which is exactly
 * the case where RLS is not carrying the rule — so the pitch is read first and its `company_id`
 * must match the manager's. Skipping it would let a manager comment on any pitch id in the
 * database, which the policy would have prevented and the admin client will not.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pitch-recording-comment", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const manager = await requireSalesCoachManager(req);
  if (!manager) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  let body: { pitchId?: unknown; timestampS?: unknown; body?: unknown; sendToRep?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const pitchId = typeof body.pitchId === "string" ? body.pitchId : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const at = Number(body.timestampS);
  const sendToRep = body.sendToRep === true;

  if (!pitchId) return NextResponse.json({ error: "Which recording?" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "A comment needs something in it." }, { status: 400 });
  if (text.length > 2000) {
    return NextResponse.json({ error: "Keep a comment under 2000 characters." }, { status: 400 });
  }
  if (!Number.isFinite(at) || at < 0) {
    // The table's CHECK says the same thing. Saying it here too means the manager gets a sentence
    // instead of a 500, and the CHECK stays as the thing that makes it true.
    return NextResponse.json({ error: "A comment needs a point in the recording." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pitch } = await admin
    .from("pitch_scores")
    .select("id, company_id, rep_id, session_id")
    .eq("id", pitchId)
    .maybeSingle();

  if (!pitch || pitch.company_id !== manager.companyId) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const { data: inserted, error } = await admin
    .from("recording_comments")
    .insert({
      company_id: manager.companyId,
      pitch_id: pitchId,
      author_id: manager.userId,
      timestamp_s: Math.round(at),
      body: text,
      sent_to_rep: sendToRep,
    })
    .select("id, timestamp_s, body, sent_to_rep, created_at")
    .maybeSingle();

  if (error || !inserted) {
    // Never the database's words. The message can carry a column name, a constraint name or a row
    // fragment, and this response goes to a browser (CWE-209).
    console.error(
      `[recording-comment] insert failed pitch=${pitchId} manager=${manager.userId}: ${error?.message ?? "no row"}`
    );
    return NextResponse.json({ error: "Could not save the comment." }, { status: 500 });
  }

  // Item 6's other half. Best-effort: the comment is saved either way, and a rep who is not
  // notified still sees it on their Pitch detail — a degradation, not a lost comment.
  let notified = false;
  if (sendToRep) {
    notified = await notifyRecordingEvent({
      companyId: manager.companyId,
      repId: String(pitch.rep_id),
      sessionId: (pitch.session_id as string | null) ?? null,
      type: "recording_comment",
      payload: { pitch_id: pitchId, timestamp_s: Math.round(at), excerpt: text.slice(0, 160) },
    });
  }

  return NextResponse.json({ comment: inserted, notified });
}
