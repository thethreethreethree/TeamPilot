import type { SupabaseClient } from "@supabase/supabase-js";
import { VIOLATIONS_BY_ID } from "../pitchScore/rubric";

/**
 * Violations the rubric escalates to a human — "Needs your attention", item one.
 *
 * The rubric (p.6) singles one violation out from the other four:
 *
 *     Rude, dismissive, or condescending to the customer  −10  "Any instance; flag for manager
 *     review"
 *
 * Every other violation is arithmetic. This one costs ten points on a 100-point base — the
 * largest single deduction in the rubric, larger than any bonus — on a judgement an LLM made
 * about someone's manner. The rubric's answer is not to soften it but to require that a person
 * confirm it, and the board renders that as *"Pitch on Thu 17 Sep, −10 applied. Confirm or
 * remove."* with a Review button.
 *
 * `flagsForReview` HAS BEEN ON THE RUBRIC ITEM SINCE IT WAS WRITTEN AND WAS READ BY NOTHING.
 * That is the same class the writer audit gates one level down: a field declared, carrying a real
 * decision, consumed by no surface. The board said so on screen — "Rude-or-dismissive flags are
 * not wired into this list yet" — which is the honest version and not the finished one.
 *
 * THE SET IS DERIVED FROM THE RUBRIC, NOT LISTED HERE. A second violation gaining
 * `flagsForReview` must start appearing in this queue without anyone remembering to edit a
 * constant (§2.2).
 */

/** Violation ids the rubric marks for human review. Derived, never hard-coded. */
export const REVIEW_FLAG_IDS: ReadonlySet<string> = new Set(
  [...VIOLATIONS_BY_ID.values()].filter((v) => v.flagsForReview).map((v) => v.id)
);

export type ReviewFlag = {
  pitchId: string;
  repId: string;
  repName: string | null;
  itemId: string;
  /** The rubric's label, so the row reads without a lookup. */
  label: string;
  /**
   * What this pitch was ACTUALLY docked, as a positive number. The board prints it as
   * "−10 applied", and *applied* is the load-bearing word.
   */
  deduction: number;
  recordedAt: string;
  /** The evidence the scorer stored — what it heard, so a manager can judge it. */
  evidence: string | null;
  /** Seconds into the recording, so Review can open at the moment. Null when untimed. */
  atSeconds: number | null;
};

/** One page of the queue, plus how many are outstanding behind it. */
export type ReviewFlagPage = {
  flags: ReviewFlag[];
  /**
   * How many unreviewed flags exist, not how many are in `flags`.
   *
   * A bounded list that cannot say it is bounded is a list that claims to be the whole set. The
   * board prints "showing 50 of 137" from this, and the difference is the point.
   */
  total: number;
};

/**
 * The page size. Not exported — nothing outside this file decides it, and the surface reports
 * the bound from `total` rather than by knowing the number.
 */
const REVIEW_FLAG_PAGE = 50;

/**
 * One page of unreviewed flags for a company, with the true unreviewed total.
 *
 * "UNREVIEWED" IS THE ABSENCE OF AN OVERRIDE, and that is the whole design. A manager has exactly
 * two answers — confirm it or remove it — and BOTH are recorded the same way: an override row
 * through `apply_pitch_score_override`, one setting the violation to `removed` and the other
 * re-affirming `awarded` at the same points. So "has a human looked at this" is "does an override
 * row exist for this (pitch, item)", with no new table and no status column to keep in step.
 *
 * The alternative — a `reviewed_at` column on the event — would be a second record of a decision
 * the override log already holds, and the two would drift the first time one was written without
 * the other (§3.1, §2.2).
 *
 * Returns null on a failed read, never an empty list: an empty attention queue is a claim that
 * there is nothing to look at, and on this board that reads as reassurance.
 */
export async function readReviewFlags(
  args: { companyId: string; nameByRep: ReadonlyMap<string, string>; limit?: number },
  db: SupabaseClient
): Promise<ReviewFlagPage | null> {
  const ids = [...REVIEW_FLAG_IDS];
  if (ids.length === 0) return { flags: [], total: 0 };

  /**
   * THE ANTI-JOIN HAPPENS IN THE DATABASE (view `unreviewed_violation_flags`, migration 0264),
   * and that is a correctness fix rather than a speed one.
   *
   * The first version of this function read the most recent N events and dropped the reviewed
   * ones afterwards. The reviewed rows therefore SPENT THE BUDGET: once a company had N flagged
   * events, an older unanswered flag could never surface again, and reviewing all N rendered the
   * card empty while the flag sat there. The feature's own think doc named "a successful read
   * that looks like nothing to do" as the failure to avoid, and the limit smuggled it back in.
   *
   * `count: "exact"` rides along on the same request, so the total is the unreviewed total — not
   * the page size, and not a second query that could disagree with the first.
   *
   * ORDERED BY `recorded_at`, NOT `id`. The first version ordered by `id` descending to mean
   * "most recent"; `pitch_score_events.id` is `gen_random_uuid()`, so that ordering was arbitrary
   * — the queue was not showing the newest flags, it was showing an unpredictable fifty.
   */
  const {
    data: events,
    error,
    count,
  } = await db
    .from("unreviewed_violation_flags")
    .select("pitch_id, item_id, points, timestamp_s, evidence, rep_id, recorded_at", {
      count: "exact",
    })
    .in("item_id", ids)
    .eq("company_id", args.companyId)
    .order("recorded_at", { ascending: false })
    .limit(args.limit ?? REVIEW_FLAG_PAGE);

  if (error || !events) return null;

  const rows = events as unknown as Array<{
    pitch_id: string;
    item_id: string;
    points: number | string;
    timestamp_s: number | null;
    evidence: string | null;
    rep_id: string | null;
    recorded_at: string | null;
  }>;

  const flags = rows.map((r): ReviewFlag => {
      const rubric = VIOLATIONS_BY_ID.get(r.item_id);
      const repId = r.rep_id ?? "";
      return {
        pitchId: r.pitch_id,
        repId,
        repName: args.nameByRep.get(repId) ?? null,
        itemId: r.item_id,
        label: rubric?.label ?? r.item_id,
        /**
         * THE STORED POINTS, not the rubric's face value — corrected while re-reading this file.
         *
         * I wrote it the other way first, reasoning that the row should say what the RULE costs.
         * The board's own word settles it: "−10 **applied**". A manager is confirming a deduction
         * that already happened to a real score, and the number in front of them has to be that
         * one.
         *
         * They are identical for `viol.rude`, which has no `maxTotal` — which is exactly why the
         * mistake was invisible and would have stayed invisible. It bites the day a second
         * violation gains `flagsForReview` AND a ceiling: the rubric would say −6 while the pitch
         * lost −2, and a manager would remove a deduction that was never that large.
         *
         * Stored as a positive magnitude (see `keyMoments`), so `Math.abs` is belt-and-braces
         * rather than a conversion. The rubric is the fallback only when the row carries no
         * points at all.
         */
        deduction: Math.abs(Number(r.points)) || rubric?.deduction || 0,
        recordedAt: r.recorded_at ?? "",
        evidence: r.evidence,
        atSeconds:
          r.timestamp_s === null || r.timestamp_s === undefined ? null : Number(r.timestamp_s),
      };
    });

  // `count` is null when PostgREST declines to count. Falling back to the page length would
  // claim the page IS the total, which is the assertion this field exists to stop making.
  return { flags, total: count ?? flags.length };
}

/**
 * The two answers, as the values the override route already accepts.
 *
 * Exported so the surface cannot invent a third. `confirm` re-affirms the violation at its own
 * points — a no-op to the score and a real entry in the log, which is the point: the rep can see
 * that a human looked and agreed, rather than the flag simply going quiet.
 */
export const REVIEW_ANSWER = {
  confirm: "awarded",
  remove: "removed",
} as const;

export type ReviewAnswer = keyof typeof REVIEW_ANSWER;
