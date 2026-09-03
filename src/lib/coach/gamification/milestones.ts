import { STRONG_SESSION_THRESHOLD } from "./bands";

/**
 * Gamification milestones — the Arena's 5 badges. GAM-R13: their earned-at date is DERIVED from the immutable
 * append-only ledger (+ the rep's sold sessions), never a mutable store — so the date is durable and truthful by
 * construction (the source can't change under it). This is the ONE definition of the milestone set; both the
 * server (my-points, which has the FULL history) and the Arena summary read it, so the set can't drift (single-source).
 *
 * The earned-at is computed where the FULL history lives (the my-points route pages past the 1000-row cap); the
 * Arena only receives the recent trend window, so it could not compute spark/century from its own rows.
 */
export const MILESTONE_KEYS = ["spark", "flame", "deal", "century", "closer"] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export const MILESTONE_TITLES: Record<MilestoneKey, string> = {
  spark: "First pitch scored",
  flame: "A strong session (80+)",
  deal: "First deal closed",
  century: "100 sessions",
  closer: "10 deals — Closer",
};

/** The earned-at (ISO string) for each milestone, or null if not yet earned. `null` everywhere = a brand-new rep. */
export type MilestoneDates = Record<MilestoneKey, string | null>;

/**
 * Derive each milestone's earned-at from the rep's FULL point history + their sold-session dates.
 *   spark   = the first scored pitch            flame = the first strong (>=80) pitch
 *   century = the 100th scored pitch            deal  = the first closed deal    closer = the 10th closed deal
 * Inputs need not be pre-sorted — we sort ascending by date here so the "first"/"Nth" are unambiguous.
 */
export function deriveMilestoneDates(
  points: ReadonlyArray<{ points: number; created_at: string }>,
  soldDates: ReadonlyArray<string>,
): MilestoneDates {
  const asc = [...points].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const sold = [...soldDates].sort();
  return {
    spark: asc[0]?.created_at ?? null,
    flame: asc.find((r) => r.points >= STRONG_SESSION_THRESHOLD)?.created_at ?? null,
    century: asc.length >= 100 ? (asc[99]?.created_at ?? null) : null,
    deal: sold[0] ?? null,
    closer: sold.length >= 10 ? (sold[9] ?? null) : null,
  };
}
