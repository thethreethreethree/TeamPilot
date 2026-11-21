import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { notifyCommentMention, notifyRecordingEvent } from "@/lib/coach/recordings/notifyRecording";
import { treeAllowsRep } from "@/lib/api/treeAccess";

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

  let body: { pitchId?: unknown; timestampS?: unknown; body?: unknown; sendToRep?: unknown; visibility?: unknown; mentions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const pitchId = typeof body.pitchId === "string" ? body.pitchId : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const at = Number(body.timestampS);
  const sendToRep = body.sendToRep === true;
  // RSS F9.8 (0293): who may read it, and who is @mentioned. Default 'everyone' = the behaviour before 0293.
  const visibility = body.visibility === "named" || body.visibility === "only_me" ? body.visibility : "everyone";
  const mentions = Array.isArray(body.mentions)
    ? [...new Set(body.mentions.filter((x): x is string => typeof x === "string"))].filter((id) => id !== manager.userId)
    : [];
  if (mentions.length > 20) return NextResponse.json({ error: "Mention at most 20 people." }, { status: 400 });
  if (visibility === "named" && mentions.length === 0) {
    return NextResponse.json({ error: "Name at least one person, or choose Everyone or Only me." }, { status: 400 });
  }
  if (visibility === "only_me" && mentions.length > 0) {
    return NextResponse.json({ error: "A note for only you can't mention anyone." }, { status: 400 });
  }
  // "Sent to the rep" must mean the rep can read it: sent_to_rep feeds "feedback given" (feedback.ts), and a sent
  // comment the rep cannot see would be counted as feedback nobody received.
  if (sendToRep && visibility === "only_me") {
    return NextResponse.json({ error: "A note for only you can't also be sent to the rep." }, { status: 400 });
  }

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
  // Reporting tree (RSS Phase 0 step 8): service-role route, so it asks the RLS question explicitly.
  if (!(await treeAllowsRep(req, String(pitch.rep_id)))) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  if (sendToRep && visibility === "named" && !mentions.includes(String(pitch.rep_id))) {
    return NextResponse.json({ error: "To send it to the rep, name the rep too, or choose Everyone." }, { status: 400 });
  }
  // Everyone mentioned must be able to read this comment under the SAME rule the database uses
  // (rss_comment_base_visible, 0293). Refused with names rather than mentioned-but-unseen.
  const mentioned: Array<{ id: string; name: string | null }> = [];
  if (mentions.length) {
    const { data: people } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", manager.companyId)
      .in("id", mentions);
    const byId = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name]));
    const cannot: string[] = [];
    for (const id of mentions) {
      if (!byId.has(id)) {
        cannot.push("someone not on your team");
        continue;
      }
      const { data: ok, error: vErr } = await admin.rpc("rss_comment_base_visible", { viewer: id, p_pitch: pitchId, p_sent: sendToRep });
      if (vErr) {
        console.error(`[recording-comment] mention check failed pitch=${pitchId}: ${vErr.message}`);
        return NextResponse.json({ error: "Mentions are waiting on database migration 0293." }, { status: 503 });
      }
      if (ok === true) mentioned.push({ id, name: byId.get(id) ?? null });
      else cannot.push(byId.get(id) ?? "a teammate");
    }
    if (cannot.length) {
      return NextResponse.json(
        { error: `${cannot.join(", ")} can't see this call${sendToRep ? "" : " (or it isn't sent to the rep)"}, so they can't be mentioned.` },
        { status: 400 },
      );
    }
  }

  // With a visibility choice or mentions, the comment and its mentions are written in ONE transaction
  // (rss_insert_comment, 0296): a 'named' comment without its mention rows would read as sent while nobody but the
  // author could open it. A plain comment keeps the original single insert (works before 0293/0296 are applied).
  let inserted: { id: string; timestamp_s: number; body: string; sent_to_rep: boolean; created_at: string } | null = null;
  let error: { message: string } | null = null;
  if (visibility !== "everyone" || mentioned.length) {
    const r = await admin.rpc("rss_insert_comment", {
      p_company: manager.companyId,
      p_pitch: pitchId,
      p_author: manager.userId,
      p_timestamp_s: Math.round(at),
      p_body: text,
      p_sent: sendToRep,
      p_visibility: visibility,
      p_mentions: mentioned.map((m) => m.id),
    });
    if (r.error) error = r.error;
    else inserted = { id: String(r.data), timestamp_s: Math.round(at), body: text, sent_to_rep: sendToRep, created_at: new Date().toISOString() };
  } else {
    const r = await admin
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
    error = r.error;
    inserted = r.data;
  }

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

  // Mentions are already saved with the comment (one transaction). Telling them is best-effort per person.
  let mentionedCount = 0;
  if (mentioned.length) {
    {
      const { data: me } = await admin.from("profiles").select("full_name").eq("id", manager.userId).maybeSingle();
      for (const m of mentioned) {
        const ok = await notifyCommentMention({
          companyId: manager.companyId,
          recipientId: m.id,
          repId: String(pitch.rep_id),
          sessionId: (pitch.session_id as string | null) ?? null,
          payload: { pitch_id: pitchId, timestamp_s: Math.round(at), excerpt: text.slice(0, 160), author_name: (me?.full_name as string | null) ?? null },
        });
        if (ok) mentionedCount += 1;
      }
    }
  }

  return NextResponse.json({ comment: { ...inserted, visibility }, notified, mentioned: mentionedCount });
}
