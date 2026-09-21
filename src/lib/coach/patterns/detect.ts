import type { Grade } from "../pitchScore/rubric";

/**
 * Pattern detection — a repeated miss, separated from a bad day.
 *
 * WHAT MAKES THIS A PATTERN AND NOT A COUNT. §3.2 says a problem may not be surfaced to a human
 * until it links to a minimum threshold of supporting signals, and that the threshold is
 * structural rather than left to discretion. For this feature that clause has a number:
 * `MISS_THRESHOLD` misses inside `WINDOW` applicable pitches. Below it, a rep missed something
 * twice and a manager would be coaching noise.
 *
 * A pattern is also a claim about a named person, shown to their manager. That is the reason the
 * strip travels with the verdict: "you missed the price anchor in 5 of your last 7" is checkable
 * by the rep, and "you have a problem with price" is not.
 */

/** Misses required inside the window before a pattern opens. From the mockups' "3 of the last 10". */
export const MISS_THRESHOLD = 3;

/** Applicable pitches considered. Applicable, not calendar — see C4 and `applicable` below. */
export const WINDOW = 10;

/**
 * Does this grade count as a miss?
 *
 * LOGIC-AND-CONTRADICTIONS.md B4 — the guide's open decision #3 asks whether a Partial counts, and
 * the mockups only ever count Missed:
 *
 *   "Detection takes the grade predicate as a parameter defaulting to `grade === 'missed'`.
 *    Flipping it to include Partial is a one-line change, and the choice changes how many patterns
 *    open for every rep in the product."
 *
 * So it is a parameter with a name, not a comparison buried in a loop. Changing the product's
 * sensitivity should cost one argument and be visible in a diff, because a rep whose Partials
 * suddenly became misses would see patterns open across their whole history overnight.
 */
export type MissPredicate = (grade: Grade) => boolean;
export const missedOnly: MissPredicate = (g) => g === "missed";
export const missedOrPartial: MissPredicate = (g) => g === "missed" || g === "partial";

/** One pitch in which the item was graded — i.e. in which it APPLIED. */
export type GradedPitch = {
  pitchId: string;
  /** ISO instant. Used only for ordering and for the caller's own windowing. */
  recordedAt: string;
  grade: Grade;
  /** Points actually awarded for this item in this pitch. */
  points: number;
};

export type Detection = {
  /** Misses inside the strip. */
  misses: number;
  /**
   * Pitches in the strip — `min(WINDOW, applicable)`.
   *
   * C4: "the dot strip is applicable-only, and shorter than 10 is normal". The mockups show seven
   * dots reading "5 of 7" because that rep has seven applicable pitches. Padding to ten with
   * pitches where the element never came up would open a pattern on every early-career rep, which
   * is the one group least able to tell a real finding from an artefact.
   */
  applicable: number;
  /** Newest first, so index 0 is the most recent applicable pitch. The dot strip, in order. */
  strip: readonly Grade[];
  /**
   * Average points lost per applicable pitch, over the strip.
   *
   * FROZEN BY THE CALLER at detection and never recomputed — the same reason `pitch_scores` stores
   * its components instead of recomputing on read. A pattern detected under one rubric must not
   * silently re-cost itself when the rubric changes, or a manager's "worth 4 points a pitch" turns
   * into a different number with no event explaining it. Becomes "points recovered" once fixed.
   */
  costPerPitch: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Look at one rep's history of one item and decide whether it is a pattern.
 *
 * `applicablePitches` must already be filtered to pitches where the item applied — for an element
 * that is simply "a `pitch_score_elements` row exists", since 0252 gives that table
 * `unique (pitch_id, element_id)` and writes a row only when the element was graded. Applicability
 * is row presence; there is no "not applicable" value to test for, and inventing one would be a
 * second source of truth for a fact the schema already carries.
 *
 * Order is not assumed: the caller may pass any order and this sorts newest-first before taking
 * the window, because "the last 10" is meaningless if the caller's ORDER BY and this function
 * disagree about which end is recent.
 */
export function detectPattern(
  applicablePitches: readonly GradedPitch[],
  maxPoints: number,
  isMiss: MissPredicate = missedOnly
): Detection | null {
  const strip = [...applicablePitches]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, WINDOW);

  if (strip.length === 0) return null;

  const misses = strip.filter((p) => isMiss(p.grade)).length;
  if (misses < MISS_THRESHOLD) return null;

  // Points LOST, not points scored: what the rep would have banked had every graded instance
  // landed. Averaged over the strip rather than over the misses, because "this costs you 2.4 a
  // pitch" is the number a manager weighs against every other thing they could coach.
  const lost = strip.reduce((sum, p) => sum + Math.max(0, maxPoints - p.points), 0);

  return {
    misses,
    applicable: strip.length,
    strip: strip.map((p) => p.grade),
    costPerPitch: r1(lost / strip.length),
  };
}

/**
 * Consecutive clean applicable pitches at the front of the strip.
 *
 * Exported because the status resolver needs it and the detector defines what "clean" means. Two
 * definitions of clean — one here, one there — is the drift §2.2 describes, and the term that
 * would go missing from the copy is the predicate: a codebase that flipped to
 * `missedOrPartial` for detection and left the streak on `missedOnly` would clear patterns it
 * would immediately re-open.
 */
export function cleanStreak(
  applicablePitches: readonly GradedPitch[],
  isMiss: MissPredicate = missedOnly
): number {
  const newestFirst = [...applicablePitches].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  let n = 0;
  for (const p of newestFirst) {
    if (isMiss(p.grade)) break;
    n++;
  }
  return n;
}
