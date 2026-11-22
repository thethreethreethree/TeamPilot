import { NextRequest, NextResponse } from "next/server";
import { notifyDisputeAnswered } from "@/lib/coach/gamification/notify";
import { contextsOf, type CallModule } from "@/lib/coach/sessionContext";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { readDisputes } from "@/lib/coach/pitchScore/readDisputes";
import { treeAllowsRep, treeFilterReps } from "@/lib/api/treeAccess";

/**
 * GET  /api/coach/sales-session/pitch-score/disputes   → the manager's queue
 * POST /api/coach/sales-session/pitch-score/disputes   { pitchId, itemId?, note } → answer one
 *
 * MANAGER-ONLY, BOTH VERBS. A rep must not read a colleague's dispute, and must not answer their
 * own — an answer is the thing that closes a complaint, so a rep who could write one could close
 * their own and the queue would mean nothing.
 *
 * The predicate is not expressed here. `requireSalesCoachManager` fetches and
 * `isSalesCoachManager` decides (§2.2) — this route consumes the verdict. The local copy of that
 * rule that used to live in the calibration route is the reason the shared helper exists.
 *
 * AN ANSWER IS AN EVENT, AND IT IS NOT A SCORE CHANGE. Same rule as the dispute itself: the reply
 * appends and writes no points. A manager who genuinely mis-scored re-scores the pitch, which is
 * a separate, visible action — folding a score change into a reply would make the leaderboard
 * quietly editable by whoever answers the most complaints.
 */
// Exported so a test can pin its SHAPE. The reason rep_id cannot be chosen by the caller is
// that this schema has no field for it and zod strips unknown keys — which is real protection
// but invisible protection. A mutation proved a behavioural test of it passes by accident, so
// the guard is asserted where it actually lives: adding repId here must fail a test.
export const AnswerSchema = z.object({
  pitchId: z.string().uuid(),
  /** The item being answered. Must match the dispute's item, or both are absent (whole score). */
  itemId: z.string().max(120).optional(),
  note: z.string().trim().min(1).max(2000),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pitch-disputes-get", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const repId = req.nextUrl.searchParams.get("repId") ?? undefined;
  const includeAnswered = req.nextUrl.searchParams.get("includeAnswered") === "1";

  const disputes = await readDisputes({
    companyId: mgr.companyId,
    ...(repId ? { repId } : {}),
    includeAnswered,
  });

  if (disputes === null) {
    // A failed read must not render as an empty queue. "No disputes" is an answer a manager acts
    // on by doing nothing, which is the worst possible response to a queue that is actually full.
    return NextResponse.json({ error: "Could not load the dispute queue." }, { status: 500 });
  }

  // Reporting tree (RSS Phase 0 step 8): service-role route, so it asks the RLS question explicitly.
  // readDisputes reads the company with the service role; only the reps this manager may see are kept.
  const visible = new Set(await treeFilterReps(req, [...new Set(disputes.map((d) => d.repId))]));
  const mine = disputes.filter((d) => visible.has(d.repId));

  // Each module's queue holds its own calls' disputes (founder 2026-11-22: Remote Sales separate from Sales Coach):
  // ?module=remote_sales → phone/video; default → in-person. The channel comes from pitch_scores_by_channel (0301), the
  // same view every other Sales Coach / Remote Sales split reads. A failed channel read is a 500, never a wrong queue.
  const scope: CallModule = req.nextUrl.searchParams.get("module") === "remote_sales" ? "remote_sales" : "sales_coach";
  const ids = [...new Set(mine.map((d) => d.pitchId))];
  if (ids.length === 0) return NextResponse.json({ disputes: [] });
  // In chunks: a long id list in one URL can exceed proxy limits and fail the whole queue.
  const ch: Array<{ id: string; channel: string }> = [];
  let chErr: { message: string } | null = null;
  for (let i = 0; i < ids.length && !chErr; i += 150) {
    const r = await createAdminClient()
      .from("pitch_scores_by_channel")
      .select("id, channel")
      .eq("company_id", mgr.companyId)
      .in("id", ids.slice(i, i + 150));
    if (r.error) chErr = r.error;
    else ch.push(...((r.data ?? []) as Array<{ id: string; channel: string }>));
  }
  if (chErr) {
    console.error(`[pitch-disputes] channel read failed company=${mgr.companyId}: ${chErr.message}`);
    return NextResponse.json({ error: "Could not load the dispute queue." }, { status: 500 });
  }
  const allowed = new Set<string>(contextsOf(scope));
  const inScope = new Set(ch.filter((r) => allowed.has(r.channel)).map((r) => String(r.id)));
  return NextResponse.json({ disputes: mine.filter((d) => inScope.has(d.pitchId)) });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-pitch-disputes-answer", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const body = await readBody(req, AnswerSchema);
  if (body instanceof NextResponse) return body;

  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const admin = createAdminClient();

  // The pitch must belong to the manager's company. Without this a manager could answer a dispute
  // in another tenant by guessing a uuid — `events` is filtered by company on the way OUT, but
  // this is a write and the tenant has to be proven on the way IN.
  const { data: pitch, error: readError } = await admin
    .from("pitch_scores")
    .select("id, rep_id, company_id, session_id")
    .eq("id", body.pitchId)
    .maybeSingle();

  if (readError) {
    // eslint-disable-next-line no-console
    console.error(`[pitch-disputes] pitch read failed id=${body.pitchId}: ${readError.message}`);
    return NextResponse.json({ error: "Could not open that pitch." }, { status: 500 });
  }
  if (!pitch || pitch.company_id !== mgr.companyId) {
    return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
  }
  // Reporting tree (RSS Phase 0 step 8): service-role route, so it asks the RLS question explicitly.
  if (!(await treeAllowsRep(req, String(pitch.rep_id)))) {
    return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
  }

  const { error } = await admin.from("events").insert({
    company_id: mgr.companyId,
    actor: mgr.userId,
    kind: "coach.pitch_score_answered",
    subject: `pitch:${body.pitchId}`,
    payload: {
      pitch_id: body.pitchId,
      rep_id: pitch.rep_id,
      item_id: body.itemId ?? null,
      note: body.note,
    },
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[pitch-disputes] answer insert failed pitch=${body.pitchId}: ${error.message}`);
    // Never reported as sent. A manager who believes they answered stops thinking about it, and
    // the rep is left with silence — which is exactly the state the dispute was meant to end.
    return NextResponse.json({ error: "Your reply was not saved. Please try again." }, { status: 500 });
  }

  // F15.21 (0305): the rep is told their dispute was answered. Best-effort; the answer is already on record.
  await notifyDisputeAnswered({
    companyId: mgr.companyId,
    repId: String(pitch.rep_id),
    managerId: mgr.userId,
    sessionId: (pitch.session_id as string | null) ?? null,
    pitchId: body.pitchId,
    note: body.note,
  });

  return NextResponse.json({ ok: true });
}
