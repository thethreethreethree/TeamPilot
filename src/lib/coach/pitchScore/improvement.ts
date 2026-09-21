import type { ElementStat, PeriodAggregate } from "./aggregate";

/**
 * What got BETTER — the rep measured against their own past.
 *
 * SPECIFIED, and by the document the founder ruled wins on anything a rep sees.
 * `docs/SalesCoach-KPI-System.md`, design principle 1:
 *
 *   "Measure against the agent's own baseline, not a leaderboard. The primary comparison is
 *    agent-vs-their-own-past (self-Elo)."
 *
 * and of the agent view: *"Growth-framed — lead with what improved, then growth areas."*
 *
 * The Breakdown board could not do this. It reads one period and had no baseline, so it led with
 * a strength — what the rep is best AT — which is a fact about them rather than about their
 * growth. "Your strongest is Tone" and "Tone improved 4 points this month" are different
 * sentences, and the document is explicitly about the second.
 *
 * THE UNDERSTANDING GATE IS THE HARD PART, not the subtraction. Principle 3 of the same document:
 *
 *   "No KPI asserts a conclusion without sufficient evidence. 'Insufficient data' must be a valid,
 *    visible state."
 *
 * which is §3.2 of the constitution in the KPI system's own words. A comparison of one pitch
 * against one pitch is arithmetic, not evidence: a single Hit swings an element's average by its
 * full value. So this returns a VERDICT — improved, or not enough evidence and why — and the
 * caller renders the second rather than quietly falling back to something that looks like an
 * answer.
 */

/**
 * Counted pitches required in EACH period before an improvement is asserted.
 *
 * Three, and the reasoning rather than the number is the point: with two pitches a single grade
 * moves an element's average by half its value, which is larger than almost any real improvement
 * it would be reporting. Three is the smallest count at which one pitch cannot dominate the
 * comparison on its own.
 *
 * It is a judgement, it is not in the rubric, and it is named here so it can be argued with — the
 * alternative is the same judgement buried in an inequality.
 */
export const MIN_PITCHES_FOR_COMPARISON = 3;

/** How much an element must move to be worth saying. Below this it is rounding, not growth. */
export const MIN_IMPROVEMENT_POINTS = 0.2;

export type Improvement = {
  elementId: string;
  label: string;
  /** Average points per pitch, previous period. */
  before: number;
  /** Average points per pitch, current period. */
  after: number;
  /** after − before, rounded to one place. Always positive for a returned improvement. */
  gained: number;
};

export type ImprovementVerdict =
  | { status: "improved"; top: Improvement }
  /** Enough evidence, and nothing moved up. Not the same as not knowing. */
  | { status: "no_change" }
  | { status: "insufficient"; reason: string };

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Compare a rep's current period against their previous one.
 *
 * Only elements GRADED IN BOTH periods are compared. An element that appears for the first time
 * has no baseline — its "improvement" would be its entire value, which would win every comparison
 * and tell a rep they improved most at the thing they have done once.
 */
export function biggestImprovement(
  current: PeriodAggregate,
  previous: PeriodAggregate
): ImprovementVerdict {
  if (previous.counted < MIN_PITCHES_FOR_COMPARISON) {
    return {
      status: "insufficient",
      reason: `${previous.counted} counted ${previous.counted === 1 ? "pitch" : "pitches"} in the period before this one`,
    };
  }
  if (current.counted < MIN_PITCHES_FOR_COMPARISON) {
    return {
      status: "insufficient",
      reason: `${current.counted} counted ${current.counted === 1 ? "pitch" : "pitches"} in this period`,
    };
  }

  const before = new Map<string, ElementStat>();
  for (const s of previous.elementStats) {
    if (s.gradedIn > 0) before.set(s.elementId, s);
  }

  let top: Improvement | null = null;
  for (const now of current.elementStats) {
    if (now.gradedIn <= 0) continue;
    const then = before.get(now.elementId);
    if (!then) continue; // no baseline — see the docblock

    const gained = r1(now.avgPoints - then.avgPoints);
    if (gained < MIN_IMPROVEMENT_POINTS) continue;
    if (!top || gained > top.gained) {
      top = {
        elementId: now.elementId,
        label: now.label,
        before: then.avgPoints,
        after: now.avgPoints,
        gained,
      };
    }
  }

  // Enough evidence and nothing rose. Reported as its own verdict rather than as insufficient,
  // because "you did not improve at anything this period" is a real answer and telling a rep it
  // is a data problem would be a lie in the flattering direction.
  return top ? { status: "improved", top } : { status: "no_change" };
}
