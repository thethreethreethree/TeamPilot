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
  /** What it cost, as a positive number. The board prints it as "−10 applied". */
  deduction: number;
  recordedAt: string;
  /** The evidence the scorer stored — what it heard, so a manager can judge it. */
  evidence: string | null;
  /** Seconds into the recording, so Review can open at the moment. Null when untimed. */
  atSeconds: number | null;
};

/**
 * Unreviewed flags for a company.
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
): Promise<ReviewFlag[] | null> {
  const ids = [...REVIEW_FLAG_IDS];
  if (ids.length === 0) return [];

  const { data: events, error } = await db
    .from("pitch_score_events")
    .select("id, pitch_id, item_id, points, timestamp_s, evidence, pitch_scores!inner(id, rep_id, company_id, recorded_at)")
    .eq("type", "violation")
    .in("item_id", ids)
    .eq("pitch_scores.company_id", args.companyId)
    .order("id", { ascending: false })
    .limit(args.limit ?? 50);

  if (error || !events) return null;

  const rows = events as unknown as Array<{
    pitch_id: string;
    item_id: string;
    points: number | string;
    timestamp_s: number | null;
    evidence: string | null;
    pitch_scores: { rep_id: string; recorded_at: string } | null;
  }>;
  if (rows.length === 0) return [];

  // One read of the overrides across every flagged pitch, rather than one per row.
  const { data: overrides } = await db
    .from("pitch_score_overrides")
    .select("pitch_id, item_id")
    .eq("item_type", "violation")
    .in("pitch_id", rows.map((r) => r.pitch_id));

  const reviewed = new Set(
    ((overrides ?? []) as Array<{ pitch_id: string; item_id: string }>).map(
      (o) => `${o.pitch_id}:${o.item_id}`
    )
  );

  return rows
    .filter((r) => !reviewed.has(`${r.pitch_id}:${r.item_id}`))
    .map((r): ReviewFlag => {
      const rubric = VIOLATIONS_BY_ID.get(r.item_id);
      const repId = r.pitch_scores?.rep_id ?? "";
      return {
        pitchId: r.pitch_id,
        repId,
        repName: args.nameByRep.get(repId) ?? null,
        itemId: r.item_id,
        label: rubric?.label ?? r.item_id,
        // The rubric's deduction, not the stored points: the stored value is what this pitch was
        // docked, and on a capped violation those differ. The row says what the RULE costs.
        deduction: rubric?.deduction ?? Math.abs(Number(r.points) || 0),
        recordedAt: r.pitch_scores?.recorded_at ?? "",
        evidence: r.evidence,
        atSeconds:
          r.timestamp_s === null || r.timestamp_s === undefined ? null : Number(r.timestamp_s),
      };
    });
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
