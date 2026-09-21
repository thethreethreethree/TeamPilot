import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/coach/sales-session/pitch-score/dispute
 *   { pitchId, itemId?, timestampS?, note }
 *
 * A rep saying "this grade is wrong."
 *
 * WHY THIS EXISTS AT ALL, AND WHY IT IS NOT OPTIONAL. The rubric screen already shipped telling
 * reps: *"A pitch never scores below 0. Think a score is wrong? Tap Dispute on the pitch."* That
 * promise was live in the product with nothing behind it. A score a rep cannot contest is not a
 * coaching tool, it is a verdict — and the whole scoring design (evidence on every element, a
 * timestamp on every claim, the rejected-bonus confidence kept rather than dropped) only pays off
 * if there is somewhere for the rep to point at it.
 *
 * AN EVENT, NOT A COLUMN. §3.1: everything is an event, append-only. A dispute is a genuine domain
 * event — someone said something, at a time — unlike the scoring evidence rows, which are a derived
 * artifact. So it appends and never updates. The manager's response will be a second event, and the
 * thread is the two of them in order, which is exactly the shape §3.1 asks for.
 *
 * NOT A SCORE CHANGE. This route writes no points. A dispute that silently re-scored the pitch
 * would let a rep edit their own leaderboard position by complaining, and would destroy the one
 * thing that makes the number worth anything. A manager override is a separate, gated action.
 *
 * THE GATE IS THE READ. `pitches` RLS scopes a select to the rep who gave the pitch or a manager
 * in the same company. Reading the pitch through the CALLER's client and 404-ing on null is
 * therefore the whole access check — a same-company peer rep cannot dispute someone else's score,
 * and no ownership rule is copied into this file to drift from the policy.
 */
const BodySchema = z.object({
  pitchId: z.string().uuid(),
  /** The element, bonus or violation being disputed. Absent = the whole score. */
  itemId: z.string().max(120).optional(),
  /** Where in the recording, so the manager lands on the moment rather than hunting for it. */
  timestampS: z.number().int().min(0).max(86_400).optional(),
  note: z.string().trim().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  // Tighter than the scoring route's 12/min. A dispute is a deliberate act; a burst of them is
  // either a mistake or an attempt to bury a manager's queue.
  const limited = rateLimit(req, { id: "coach-pitch-dispute", windowMs: 60_000, max: 6 });
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

  // RLS IS the gate — see the docblock. Null means "not yours and you are not a manager".
  const { data: pitch, error: readError } = await supabase
    .from("pitches")
    .select("id, rep_id, session_id, company_id")
    .eq("id", body.pitchId)
    .maybeSingle();

  if (readError) {
    // Classified rather than folded into the 404 below: a failed read reported as "not found"
    // would tell a rep their pitch does not exist when the database was simply unreachable.
    // eslint-disable-next-line no-console
    console.error(`[pitch-dispute] pitch read failed id=${body.pitchId}: ${readError.message}`);
    return NextResponse.json({ error: "Could not open that pitch." }, { status: 500 });
  }
  if (!pitch) {
    return NextResponse.json({ error: "Pitch not found or not accessible." }, { status: 404 });
  }

  const { error } = await supabase.from("events").insert({
    company_id: companyId,
    actor: auth.user.id,
    kind: "coach.pitch_score_disputed",
    subject: `pitch:${body.pitchId}`,
    payload: {
      pitch_id: body.pitchId,
      // The rep the score belongs to, stored alongside the actor. They are usually the same
      // person; when a manager files one on a rep's behalf, the payload keeps both straight.
      rep_id: pitch.rep_id,
      session_id: pitch.session_id,
      item_id: body.itemId ?? null,
      timestamp_s: body.timestampS ?? null,
      note: body.note,
    },
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[pitch-dispute] event insert failed pitch=${body.pitchId}: ${error.message}`);
    // The rep must not be told "sent" when nothing was recorded. A dispute they believe is filed
    // and which does not exist is worse than an error they can retry.
    return NextResponse.json({ error: "Your dispute was not sent. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
