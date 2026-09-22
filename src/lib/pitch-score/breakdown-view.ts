/**
 * The Breakdown board's rules — the parts that can be wrong without looking wrong.
 *
 * PURE, AND SEPARATE FROM THE SCREEN, for the reason this codebase keeps rediscovering: a rule
 * living beside `coach-api` cannot be tested at all, because that module imports `expo/fetch` and
 * the whole file fails to load in the runner.
 *
 * WHY BREAKDOWN IS BUILT BEFORE PROGRESS, against the order the boards are drawn in. This screen
 * carries the reconciliation the guide's launch checklist demands — *"Every period reconciles:
 * sections sum to base; base + bonus − violations = avg score"*. If that identity does not hold,
 * every number on the Progress gauge is wrong too, and the gauge is the last place anyone would
 * notice. Build the screen that can fail loudly first.
 */
import { lowestSection, type RubricSection, type RubricViolation } from '@/lib/pitch-score/rubric';
import type { ElementStat, PeriodAggregate, SectionId, ViolationStat } from '@/lib/pitch-score/types';

/** One decimal, which is the precision every one of these figures is printed at. */
const r1 = (n: number) => Math.round(n * 10) / 10;

export type SectionRow = {
  id: SectionId;
  label: string;
  points: number;
  max: number;
  /** 0-1, for the bar. Clamped, so a correction above max cannot overrun the track. */
  fraction: number;
  /** Exactly one row carries this, and it is NOT the row with the fewest points. */
  lowest: boolean;
};

/**
 * The six section bars, in the rubric's own order.
 *
 * ORDER COMES FROM THE RUBRIC, not from the aggregate's key order, because an object's key order is
 * an accident of serialisation and the board's order is a design decision — Introduction through
 * Delivery, the order a pitch actually happens in.
 */
export function sectionRows(
  sectionAverages: Readonly<Partial<Record<SectionId, number>>>,
  sections: readonly RubricSection[],
): SectionRow[] {
  const worst = lowestSection(sectionAverages, sections);
  return sections.map((s) => {
    const points = sectionAverages[s.id] ?? 0;
    return {
      id: s.id,
      label: s.label,
      points,
      max: s.maxPoints,
      fraction: s.maxPoints > 0 ? Math.min(1, Math.max(0, points / s.maxPoints)) : 0,
      lowest: s.id === worst,
    };
  });
}

export type Opportunity = {
  elementId: string;
  label: string;
  avgPoints: number;
  maxPoints: number;
  /** Points per pitch left on the table — `maxPoints − avgPoints`. */
  gainPerPitch: number;
};

/**
 * BIGGEST OPPORTUNITY — exactly one, and ranked by UNEARNED POINTS rather than by hit rate.
 *
 * The distinction is the whole value of the card. A rep missing an 8-point element half the time is
 * leaving more on the table than one missing a 1-point element every time, and a hit-rate ranking
 * would put the 1-pointer on top — true, and useless.
 *
 * ONE CALLOUT, NOT FOUR. The mockup carries exactly one [OBSERVED — p2, opened at full resolution];
 * the shipped web board opens with up to four stacked, which `EVIDENCE.md` flags. Four ranked
 * opportunities is a list, and a list of priorities is not a priority.
 *
 * Null when there is nothing to show — no counted pitches, or every element already full.
 */
export function biggestOpportunity(elementStats: readonly ElementStat[]): Opportunity | null {
  let best: Opportunity | null = null;
  for (const e of elementStats) {
    const gainPerPitch = r1(e.maxPoints - e.avgPoints);
    if (gainPerPitch <= 0) continue;
    if (best && gainPerPitch <= best.gainPerPitch) continue;
    best = {
      elementId: e.elementId,
      label: e.label,
      avgPoints: e.avgPoints,
      maxPoints: e.maxPoints,
      gainPerPitch,
    };
  }
  return best;
}

/** The period figure for the callout's second sentence: "about +40 points across your 18 pitches". */
export function opportunityAcrossPeriod(gainPerPitch: number, counted: number): number {
  return Math.round(gainPerPitch * counted);
}

export type Reconciliation = {
  base: number;
  bonus: number;
  violations: number;
  /** What the three parts add up to. */
  computed: number;
  /** What the server says the average actually is. */
  reported: number;
  /** Do they agree to the printed precision? */
  holds: boolean;
};

/**
 * The footer is an ASSERTION, not decoration.
 *
 * The launch checklist requires `base + bonus − violations = avg score` for every period. Printing
 * the sum without checking it would turn the one line that proves the board into the one line that
 * hides a broken board — four numbers that look like arithmetic and are not.
 *
 * COMPARED AT ONE DECIMAL, the precision the board prints.
 *
 * An earlier version of this comment justified that with an invented example — it claimed
 * 68.9 + 14.6 − 3.2 came to 80.30000000000001. It does not. That sum is exact in JS, as are all four
 * reconciliations across the three mockups; the number was asserted without being computed, which is
 * the same shape as describing a file from its name.
 *
 * The rounding still earns its place, on a case that IS inexact and was measured: Humza Khan's six
 * sections on the manager board add to 61.99999999999999 rather than 62. So the guard belongs to
 * `sectionsSumToBase` above all, and the example here is now one that was checked.
 */
export function reconciliation(aggregate: PeriodAggregate): Reconciliation {
  const base = aggregate.avgBase;
  const bonus = aggregate.avgBonus;
  const violations = aggregate.avgViolations;
  const computed = r1(base + bonus - violations);
  const reported = r1(aggregate.avgPitchScore);
  return { base, bonus, violations, computed, reported, holds: computed === reported };
}

/**
 * Do the six sections add up to the base they are printed under?
 *
 * The other half of the checklist's demand, and the half a reader is most likely to check by eye —
 * the bars are right there above the total.
 */
export function sectionsSumToBase(rows: readonly SectionRow[], avgBase: number): boolean {
  return r1(rows.reduce((n, r) => n + r.points, 0)) === r1(avgBase);
}

export type ViolationRow = {
  violationId: string;
  label: string;
  /** Positive magnitude; the minus sign belongs to the display. */
  avgDeduction: number;
  rate: number;
  /** True when this violation never happened in the period. */
  clean: boolean;
};

/**
 * Every violation in the rubric, including the ones that never happened.
 *
 * A ZERO ROW IS SHOWN, NOT HIDDEN. The mockup renders "Rude or dismissive · None · 0" [OBSERVED,
 * p2], and that row is the most valuable one on the card: it is the rep being told they did not do
 * the worst thing on the list. Dropping empty rows would make the card shorter and quietly convert
 * "you were never rude" into no information at all.
 *
 * Driven by the RUBRIC's list rather than by the stats, because a violation with no occurrences may
 * be absent from `violationStats` entirely — and absent is exactly the row worth printing.
 */
export function violationRows(
  violationStats: readonly ViolationStat[],
  rubricViolations: readonly RubricViolation[],
): ViolationRow[] {
  const bySlug = new Map(violationStats.map((v) => [v.violationId, v]));
  return rubricViolations.map((v) => {
    const stat = bySlug.get(v.id);
    return {
      violationId: v.id,
      label: v.label,
      avgDeduction: stat?.avgDeduction ?? 0,
      rate: stat?.rate ?? 0,
      clean: !stat || stat.rate === 0,
    };
  });
}

/**
 * The element rows inside the expanded section.
 *
 * Only the lowest section expands on the mockup, and it expands INLINE inside its own card rather
 * than opening a screen [OBSERVED, p2].
 */
export function elementsForSection(
  elementStats: readonly ElementStat[],
  section: SectionId,
): ElementStat[] {
  return elementStats.filter((e) => e.section === section);
}
