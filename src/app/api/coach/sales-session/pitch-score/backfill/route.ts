import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { rateLimit } from "@/lib/api/rateLimit";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  scoreSession,
  PERMANENT_REFUSALS,
  REFUSAL_MESSAGE,
  type ScoreRefusal,
} from "@/lib/coach/pitchScore/scoreSession";

/**
 * GET  /api/coach/sales-session/pitch-score/backfill  — how many recordings have never been scored
 * POST /api/coach/sales-session/pitch-score/backfill  — score the next batch, report what happened
 *
 * WHY THIS EXISTS. `pitch_scores` had exactly one writer and one caller: a button on one session
 * page, pressed by a human, one recording at a time. So the table held the pitches somebody
 * remembered to grade, which for a real customer was none — while ten modules read it and the
 * build plan's flowchart says "nothing can display until pitches are scored". A partner reported
 * it as "can we get the manager dashboard to start showing recordings?" and he was right.
 * Full sweep: docs/AUDIT-UNTRIGGERED-ARTIFACTS-2026-09-24.md.
 *
 * THE COUNT COMES FIRST, AND FOR FREE. GET does two cheap reads and no LLM call, so a manager
 * sees "142 recordings have never been scored" BEFORE anything is spent. Founder's decision was
 * to score the whole backlog in one pass; the number being visible first is how that stays a
 * decision rather than a surprise.
 *
 * WHY IT IS BATCHED WHEN THE DECISION WAS "ONE PASS". A serverless function dies at 300s. Grading
 * 142 recordings inside one invocation does not finish — it half-finishes and returns nothing,
 * which is worse than not starting. So each POST drains a batch and returns `remaining`, and the
 * caller loops until nothing more can be scored. That is the same contract the dissect backfill
 * already uses ("returns how many remain, so the admin runs it until remaining = 0"), and from
 * the manager's side it is still one action.
 *
 * HOW IT TERMINATES, without a new column. There is no `score_attempted_at` on a session, so a
 * recording that can never be scored (no rep speech) would stay a candidate forever and a naive
 * "loop until remaining = 0" would never stop. The contract is therefore **loop while `scored`
 * is above zero**: a pass that scores nothing new has reached the floor, and everything still
 * unscored is reported by reason instead of retried. `no_agent_turns` is decided before any LLM
 * call (generatePitchScore.ts:95), so those re-checks cost nothing when they do happen.
 */

/**
 * Recordings graded per POST.
 *
 * One grading is a single ~30-element LLM call — lighter than the dissect backfill's 5-engine
 * generation, which runs 4 per invocation inside the same 300s. Eight leaves a wide margin for
 * the slowest calls while clearing a 142-recording backlog in eighteen presses rather than
 * thirty-six.
 */
const BATCH = 8;

export const maxDuration = 300;

type Resolved =
  | { ok: false; status: 401 | 403; error: string }
  | { ok: true; companyId: string; db: Awaited<ReturnType<typeof createClient>> };

async function resolve(req: NextRequest): Promise<Resolved> {
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await db.auth.getUser();
  if (!auth?.user) return { ok: false, status: 401, error: "Not authenticated." };

  const { data: profile } = await db
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) return { ok: false, status: 403, error: "No company context." };

  // Manager-gated, not owner-gated. This spends money across the whole company's history, so the
  // owner-or-manager rule that governs scoring ONE of your own recordings is not the right gate.
  const isManager = isSalesCoachManager({
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  if (!isManager) {
    return { ok: false, status: 403, error: "Scoring the backlog is for managers." };
  }

  return { ok: true, companyId, db };
}

/**
 * Sessions that are gradeable and have no score yet, oldest first.
 *
 * A set difference in memory rather than a PostgREST anti-join: `not.in.(…)` would put every
 * scored id into the URL, and a company with a few thousand scored pitches produces a request no
 * proxy will carry. Both reads are id-only and paged to completion — `fetchAllPaged` throws
 * rather than returning a short page, because a truncated candidate list would silently under-
 * report the backlog and the whole point of the count is that it is trustworthy.
 *
 * Oldest first so "past recordings" — the thing actually asked for — come back before today's.
 */
async function unscoredSessionIds(
  db: Awaited<ReturnType<typeof createClient>>,
  companyId: string
): Promise<string[]> {
  const scored = await fetchAllPaged<{ session_id: string | null }>(
    (from, to) =>
      db
        .from("pitch_scores")
        .select("session_id")
        .eq("company_id", companyId)
        .range(from, to),
    { label: "pitch-score backfill: scored session ids" }
  );
  const done = new Set(scored.map((r) => r.session_id).filter((v): v is string => !!v));

  const sessions = await fetchAllPaged<{ id: string }>(
    (from, to) =>
      db
        .from("coaching_sessions")
        .select("id")
        .eq("company_id", companyId)
        // A huddle or a meeting is not a pitch, and scoreSession refuses them anyway — filtering
        // here keeps them out of the COUNT, so "142 unscored" never includes 60 team huddles that
        // were never going to be scored.
        .eq("session_kind", "sales")
        .in("status", ["ended", "reviewed"])
        .order("started_at", { ascending: true })
        .range(from, to),
    { label: "pitch-score backfill: candidate sessions" }
  );

  return sessions.map((s) => s.id).filter((id) => !done.has(id));
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "pitch-score-backfill-count", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const r = await resolve(req);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  try {
    const ids = await unscoredSessionIds(r.db, r.companyId);
    return NextResponse.json({ unscored: ids.length });
  } catch (err) {
    // The read failed. Reporting 0 here would say "nothing to do" about a backlog nobody counted —
    // the confident-zero this whole feature exists to stop.
    console.error("[pitch-score/backfill] count failed:", err);
    return NextResponse.json({ error: "The backlog could not be counted." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Each call fans out up to BATCH LLM gradings. Manager-gated below; this bound is what keeps a
  // held-down button from becoming a bill.
  const limited = rateLimit(req, { id: "pitch-score-backfill", windowMs: 60_000, max: 12 });
  if (limited) return limited;

  const r = await resolve(req);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  let candidates: string[];
  try {
    candidates = await unscoredSessionIds(r.db, r.companyId);
  } catch (err) {
    console.error("[pitch-score/backfill] candidate read failed:", err);
    return NextResponse.json({ error: "The backlog could not be read." }, { status: 500 });
  }

  const batch = candidates.slice(0, BATCH);
  let scored = 0;
  const refused: Partial<Record<ScoreRefusal, number>> = {};
  let haltedBy: ScoreRefusal | null = null;

  for (const sessionId of batch) {
    const outcome = await scoreSession({
      sessionId,
      companyId: r.companyId,
      db: r.db,
      // A drain must never re-bill a recording that already has a score.
      skipIfScored: true,
    });

    if (outcome.ok) {
      if (!outcome.alreadyScored) scored += 1;
      continue;
    }

    refused[outcome.reason] = (refused[outcome.reason] ?? 0) + 1;

    /**
     * STOP THE WHOLE RUN on `suppressed`, rather than working through the batch.
     *
     * Guidance being off is an ACCOUNT state (§3.4 month 1 is a control condition), not a property
     * of this recording — so every remaining session would refuse identically. Continuing would
     * turn one answerable message into eight identical ones and, on a large backlog, would walk
     * the entire history to learn something the first session already proved.
     */
    if (outcome.reason === "suppressed") {
      haltedBy = "suppressed";
      break;
    }
  }

  const remaining = Math.max(0, candidates.length - scored);

  /**
   * The line a human reads. §1.5.3: an unmet precondition must fail LOUD.
   *
   * A bare `scored: 0` is the exact sentence this feature was built to stop — it reads as "there
   * was nothing to do" when the truth is "guidance is off for this account and nothing will ever
   * be scored until it is on". Same shape as the 2026-08-14 empty-AI outage, one layer out.
   */
  const note = haltedBy
    ? `${REFUSAL_MESSAGE[haltedBy]} Nothing was scored, and nothing will be until that changes.`
    : scored === 0 && remaining > 0
      ? `Nothing in this batch could be scored. ${remaining} recording(s) remain, and the reasons are listed — re-running will not change a permanent one.`
      : null;

  return NextResponse.json({
    scored,
    remaining,
    refused,
    /** True while another POST is worth making. The caller loops on THIS, not on `remaining`. */
    more: !haltedBy && scored > 0 && remaining > 0,
    note,
    /** Which refusals are pointless to retry, so a caller need not hard-code the list. */
    permanent: [...PERMANENT_REFUSALS],
  });
}
