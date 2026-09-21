import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPitchScore } from "@/lib/coach/pitchScore/readPitchScore";
import { applyOverride } from "@/lib/coach/pitchScore/applyOverride";
import { notifyPitchCorrected } from "@/lib/coach/pitchScore/notifyCorrection";
import { BONUSES_BY_ID, ELEMENTS_BY_ID, VIOLATIONS_BY_ID } from "@/lib/coach/pitchScore/rubric";

/**
 * POST /api/coach/sales-session/pitch-score/override
 *   { pitchId, itemType, itemId, newValue, reason }
 *
 * A manager correcting one item on a scored pitch. Specified by the rubric (page 7): *"Manager
 * override: managers can adjust any bonus or violation, with the change logged."*
 *
 * MANAGER-ONLY, and this is the one gate that cannot be delegated to RLS. Everywhere else in this
 * feature the policy IS the access rule — a rep reads their own pitch because `pitch_scores` says
 * so. Here the write runs through a SECURITY DEFINER RPC with the service role, which by
 * definition bypasses RLS, so the check has to happen before the call. It consumes
 * `requireSalesCoachManager`'s verdict rather than re-expressing who a manager is (§2.2).
 *
 * A REASON IS REQUIRED, at three levels: the schema below, the table's CHECK constraint, and the
 * RPC. Three because an override without one is indistinguishable from a manager editing a number
 * they did not like, and the rep can read the reason — it is the thing that makes "the change is
 * logged" mean something to the person whose score changed.
 *
 * NOT A RE-SCORE. This corrects one item and recomputes from the evidence; it never re-runs the
 * model. A manager who thinks the whole grading is wrong re-scores the pitch, which is a different
 * and visible action that spends an LLM call.
 */
const BodySchema = z.object({
  pitchId: z.string().uuid(),
  itemType: z.enum(["element", "bonus", "violation"]),
  itemId: z.string().min(1).max(120),
  /** element: hit | partial | missed. bonus/violation: awarded | removed. */
  newValue: z.enum(["hit", "partial", "missed", "awarded", "removed"]),
  reason: z.string().trim().min(1).max(1000),
});

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  unknown_item: 422,
  invalid_value: 422,
  write_failed: 500,
};

const FAILURE_MESSAGE: Record<string, string> = {
  not_found: "That pitch could not be found.",
  unknown_item: "That item is not in the current rubric.",
  invalid_value: "That value is not valid for this kind of item.",
  write_failed: "The correction could not be saved.",
};

export async function POST(req: NextRequest) {
  // Tighter than scoring. An override changes a rep's score, and a burst of them is either a
  // mistake or somebody working through a leaderboard.
  const limited = rateLimit(req, { id: "coach-pitch-override", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  // Read the pitch WITH the service role, because the recompute needs every element and event
  // regardless of who is asking — and the tenant is proven explicitly below rather than by RLS,
  // since the service role has none.
  const admin = createAdminClient();
  const { data: row, error: readError } = await admin
    .from("pitch_scores")
    .select("id, company_id, session_id")
    .eq("id", body.pitchId)
    .maybeSingle();

  if (readError) {
    // eslint-disable-next-line no-console
    console.error(`[pitch-override] pitch read failed id=${body.pitchId}: ${readError.message}`);
    return NextResponse.json({ error: "Could not open that pitch." }, { status: 500 });
  }
  // Tenant proven on the way IN. A manager must not be able to correct a score in another company
  // by guessing a uuid — the RPC checks this too, and saying it twice here is cheap because the
  // alternative is trusting a service-role read to have been scoped by something.
  if (!row || row.company_id !== mgr.companyId) {
    return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
  }
  if (!row.session_id) {
    return NextResponse.json({ error: "That pitch has no session to read." }, { status: 409 });
  }

  const pitch = await readPitchScore(row.session_id as string, admin);
  if (!pitch) {
    // readPitchScore already logged the detail. A null here after the row was found means the
    // evidence could not be read, and correcting a score without seeing what it was built from is
    // exactly the blind edit this feature exists to avoid.
    return NextResponse.json({ error: "Could not read that pitch's evidence." }, { status: 500 });
  }

  const result = await applyOverride(
    {
      companyId: mgr.companyId,
      pitchId: body.pitchId,
      actorId: mgr.userId,
      itemType: body.itemType,
      itemId: body.itemId,
      newValue: body.newValue,
      reason: body.reason,
    },
    pitch
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: FAILURE_MESSAGE[result.reason] ?? "The correction could not be applied." },
      { status: FAILURE_STATUS[result.reason] ?? 500 }
    );
  }

  // Tell the rep. Best-effort and deliberately NOT awaited into the result: the correction is
  // already written and the score has already moved, so a failed notification must not fail this
  // request — it would undo nothing and only lose the caller's result. It IS awaited in sequence
  // rather than floated, because a serverless invocation can be frozen the moment it responds and
  // a floating promise would be dropped silently on exactly the busy requests it matters for.
  //
  // try/catch as well as the notifier's own, and that is not belt-and-braces. `notifyPitchCorrected`
  // catches internally and returns false — but that is a promise this route cannot enforce, and the
  // cost of it being broken later is that a correction which ALREADY LANDED reports as a 500. The
  // manager then applies it again, logging a second override on a score that was already right, in
  // an append-only table.
  try {
    await notifyPitchCorrected({
      companyId: mgr.companyId,
      repId: pitch.repId,
      sessionId: row.session_id as string,
    // The rubric's own label, so the alert names the item the same way every other screen does.
    // Falls back to the raw id rather than blanking: an alert about "" is worse than a technical one.
      itemLabel:
        ELEMENTS_BY_ID.get(body.itemId)?.label ??
        BONUSES_BY_ID.get(body.itemId)?.label ??
        VIOLATIONS_BY_ID.get(body.itemId)?.label ??
        body.itemId,
      total: result.total,
      qualifying: result.qualifying,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[pitch-override] notify threw after a successful override ${result.overrideId}: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }

  return NextResponse.json({
    overrideId: result.overrideId,
    base: result.base,
    total: result.total,
    qualifying: result.qualifying,
  });
}
