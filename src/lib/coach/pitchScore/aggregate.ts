import {
  BONUSES,
  ELEMENTS,
  GRADE_CREDIT,
  PRIZE_ELIGIBLE_MIN_PITCHES,
  SECTIONS,
  VIOLATIONS,
  type Grade,
  type SectionId,
} from "./rubric";
import type { PitchScore } from "./scorePitch";

/**
 * Period aggregation — Step 1 item 5 of the build guide: "Build one aggregate query per rep and
 * per team for day, week, month, all: averages, totals, section and element averages, bonus and
 * violation stats, and the KPIs. Section averages must add up to the base average."
 *
 * Every screen in the redesign reads this one shape. The rep's Progress gauge, the Breakdown
 * tables, the team cards, the reps table and the rep-detail panel are all views of the same
 * numbers at different scopes, which is why this is one function and not five.
 *
 * THE FORMULAS WERE DERIVED FROM THE PUBLISHED MOCKUP TABLES, NOT GUESSED. Each was checked
 * against the numbers the boards print before being implemented, and each check is repeated as a
 * test:
 *
 *   element average   = points x (hitRate + partialRate / 2)
 *                       verified on all five Close elements, which then sum to the section's 8.4
 *   avg Pitch Score   = totalPoints / countedPitches
 *                       verified on the rep (1445/18 = 80.3) and the team (5773/75 = 77.0)
 *   bonus average     = that bonus's total points / countedPitches
 *                       verified on seven rows of the bonus table
 *   violation average = that violation's total deduction / countedPitches
 *                       verified on four rows of the violation table
 *
 * COUNTED PITCHES ONLY. Everything here averages over QUALIFYING pitches. The boards say so
 * twice — "Your rubric averages · 18 qualifying pitches this week" and "Averages across all
 * counted pitches for the period" — and it is the point of the qualifying rule: a door slam must
 * not drag a rep's average down, and junk recordings must not be farmable for points.
 */

/** One scored pitch plus the graded detail the aggregate needs. */
/**
 * Exactly the score fields the aggregation reads — deliberately NOT the whole PitchScore.
 *
 * The full type also carries rubricVersion, elementBreakdown, deliveryScaled and
 * rejectedLowConfidence. A reader loading pitches back out of the database has no natural value
 * for elementBreakdown (it holds the element rows separately) and would have to fabricate one to
 * satisfy the type. A fabricated field that nothing reads is still a lie in the data, and the next
 * person to add a use for it gets an empty array with no indication it was never real.
 *
 * So the input is narrowed to what is genuinely used. A live PitchScore still satisfies it.
 */
export type AggregableScore = Pick<
  PitchScore,
  | "base"
  | "bonus"
  | "violations"
  | "total"
  | "qualifying"
  | "notQualifyingReason"
  | "sectionPoints"
  | "bonusBreakdown"
  | "violationBreakdown"
>;

export type AggregablePitch = {
  /**
   * Whose pitch it is. Optional because the per-rep aggregate never needed it — a rep board is
   * read with a repId filter, so every row already belongs to one person. The company-wide read
   * has no such filter, and without this the rows cannot be grouped at all: the leaderboard was
   * unbuildable on this type, not merely awkward.
   */
  repId?: string;
  score: AggregableScore;
  /** The grades that produced the score — needed for the per-element hit/partial/missed rates. */
  elements: ReadonlyArray<{ elementId: string; grade: Grade }>;
  /** Sale outcome, for the close rate. */
  outcome?: "sold" | "follow_up" | "no_sale";
};

export type ElementStat = {
  elementId: string;
  section: SectionId;
  label: string;
  maxPoints: number;
  /** points x (hitRate + partialRate/2), i.e. average points earned per counted pitch. */
  avgPoints: number;
  hitRate: number;
  partialRate: number;
  missedRate: number;
  /** How many counted pitches this element was graded in. Rates are over THIS, not over all. */
  gradedIn: number;
};

export type BonusStat = {
  bonusId: string;
  label: string;
  /** Share of counted pitches where this bonus was earned at least once. */
  earnedInRate: number;
  /** Average points contributed per counted pitch. */
  avgPoints: number;
};

export type ViolationStat = {
  violationId: string;
  label: string;
  /** Share of counted pitches where it occurred at least once. */
  rate: number;
  /** Average deduction per counted pitch, as a POSITIVE magnitude. */
  avgDeduction: number;
};

export type PeriodAggregate = {
  /** Every pitch handed in, qualifying or not. */
  pitchesTotal: number;
  /** Qualifying pitches — the denominator for every average below. */
  counted: number;
  notCounted: number;
  /** Reasons the excluded pitches were excluded, so the UI can explain "5 didn't reach Discovery". */
  notCountedReasons: Record<string, number>;

  totalPoints: number;
  avgPitchScore: number;
  avgBase: number;
  avgBonus: number;
  avgViolations: number;
  bestPitchScore: number | null;

  /** Per section, averaged over counted pitches. Sums to avgBase. */
  sectionAverages: Record<SectionId, number>;
  elementStats: ElementStat[];
  bonusStats: BonusStat[];
  violationStats: ViolationStat[];

  prizeEligible: boolean;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function aggregatePitches(pitches: readonly AggregablePitch[]): PeriodAggregate {
  const counted = pitches.filter((p) => p.score.qualifying);
  const n = counted.length;

  const notCountedReasons: Record<string, number> = {};
  for (const p of pitches) {
    if (p.score.qualifying) continue;
    const reason = p.score.notQualifyingReason ?? "Not counted";
    notCountedReasons[reason] = (notCountedReasons[reason] ?? 0) + 1;
  }

  const emptySections = Object.fromEntries(SECTIONS.map((s) => [s.id, 0])) as Record<SectionId, number>;

  if (n === 0) {
    return {
      pitchesTotal: pitches.length,
      counted: 0,
      notCounted: pitches.length,
      notCountedReasons,
      totalPoints: 0,
      avgPitchScore: 0,
      avgBase: 0,
      avgBonus: 0,
      avgViolations: 0,
      bestPitchScore: null,
      sectionAverages: emptySections,
      elementStats: [],
      bonusStats: [],
      violationStats: [],
      prizeEligible: false,
    };
  }

  const totalPoints = counted.reduce((sum, p) => sum + p.score.total, 0);

  // Section averages. Rounded ONCE at the end rather than per pitch, so the six values still sum
  // to avgBase — rounding each pitch first is how that identity quietly drifts by a tenth and the
  // Breakdown footer stops reconciling.
  const sectionSums = { ...emptySections };
  for (const p of counted) {
    for (const s of SECTIONS) sectionSums[s.id] += p.score.sectionPoints[s.id] ?? 0;
  }
  const sectionAverages = Object.fromEntries(
    SECTIONS.map((s) => [s.id, r1(sectionSums[s.id] / n)])
  ) as Record<SectionId, number>;

  // Per element: rates over the pitches where the element was actually GRADED, not over all
  // counted pitches. An element the rep never reached is not a miss they can be coached on, and
  // Pattern Interrupt applies the same applicable-only rule when it counts 3 of the last 10.
  const elementStats: ElementStat[] = [];
  for (const def of ELEMENTS) {
    let hit = 0;
    let partial = 0;
    let missed = 0;
    for (const p of counted) {
      const g = p.elements.find((e) => e.elementId === def.id);
      if (!g) continue;
      if (g.grade === "hit") hit++;
      else if (g.grade === "partial") partial++;
      else missed++;
    }
    const gradedIn = hit + partial + missed;
    if (gradedIn === 0) continue;

    const hitRate = hit / gradedIn;
    const partialRate = partial / gradedIn;
    elementStats.push({
      elementId: def.id,
      section: def.section,
      label: def.label,
      maxPoints: def.points,
      // Identical to averaging the earned points directly, and written in the boards' own terms so
      // the printed "72% hit · 16% partial" and the printed "2.4 / 3" are visibly the same claim.
      avgPoints: r1(def.points * (hitRate + partialRate * GRADE_CREDIT.partial)),
      hitRate: r3(hitRate),
      partialRate: r3(partialRate),
      missedRate: r3(missed / gradedIn),
      gradedIn,
    });
  }

  const bonusStats: BonusStat[] = [];
  for (const def of BONUSES) {
    let earnedIn = 0;
    let points = 0;
    for (const p of counted) {
      const b = p.score.bonusBreakdown.find((x) => x.bonusId === def.id);
      if (!b || b.points <= 0) continue;
      earnedIn++;
      points += b.points;
    }
    if (earnedIn === 0) continue;
    bonusStats.push({
      bonusId: def.id,
      label: def.label,
      earnedInRate: r3(earnedIn / n),
      avgPoints: r1(points / n),
    });
  }
  bonusStats.sort((a, b) => b.avgPoints - a.avgPoints);

  const violationStats: ViolationStat[] = [];
  for (const def of VIOLATIONS) {
    let occurredIn = 0;
    let deduction = 0;
    for (const p of counted) {
      const v = p.score.violationBreakdown.find((x) => x.violationId === def.id);
      if (!v || v.deduction <= 0) continue;
      occurredIn++;
      deduction += v.deduction;
    }
    // Unlike bonuses, a violation with zero occurrences is KEPT. The board prints
    // "Rude or dismissive — None — 0", and "we checked and it never happened" is a different,
    // more reassuring fact than the row being absent.
    violationStats.push({
      violationId: def.id,
      label: def.label,
      rate: r3(occurredIn / n),
      avgDeduction: r1(deduction / n),
    });
  }
  violationStats.sort((a, b) => b.avgDeduction - a.avgDeduction);

  return {
    pitchesTotal: pitches.length,
    counted: n,
    notCounted: pitches.length - n,
    notCountedReasons,
    totalPoints: r1(totalPoints),
    avgPitchScore: r1(totalPoints / n),
    avgBase: r1(counted.reduce((s, p) => s + p.score.base, 0) / n),
    avgBonus: r1(counted.reduce((s, p) => s + p.score.bonus, 0) / n),
    avgViolations: r1(counted.reduce((s, p) => s + p.score.violations, 0) / n),
    bestPitchScore: counted.reduce((best, p) => Math.max(best, p.score.total), 0),
    sectionAverages,
    elementStats,
    bonusStats,
    violationStats,
    prizeEligible: n >= PRIZE_ELIGIBLE_MIN_PITCHES,
  };
}

// ── KPIs ──────────────────────────────────────────────────────────────────────────────────────

export type ActivityKpis = {
  doorsKnocked: number;
  presentations: number;
  sold: number;
  /** presentations / doors. Null when no doors were knocked — not zero, which would read as 0%. */
  doorToPresentationRate: number | null;
  /** sold / presentations. Null when there were no presentations. */
  closeRate: number | null;
};

/**
 * Presentations.
 *
 * THE BUILD GUIDE CALLS THIS OPEN. IT IS NOT — the founder settled it on 2026-09-11, and the
 * decision is implemented in `src/lib/data/doorlog.ts` (getAllTimeKpi / getTodaysMetrics).
 *
 *   A presentation is a door where the rep SPOKE TO SOMEBODY:  doors_knocked − no_answer.
 *   It is NOT a recorded pitch.
 *
 * This reverses an earlier choice, and the reversal is what makes it binding rather than
 * arbitrary. On 2026-08-28 the founder DID pick recorded pitches, checked against one rep: 41
 * recorded against 46 non-no-answer knocks, so the sharper measure looked better. That gap did
 * not hold. Measured 2026-09-11: the same rep was 126 spoken-to against 50 recorded, and the
 * founder's own row read 18 spoken to, 3 recorded, 10 SOLD — a 333% close rate, because sales
 * are counted from knocks and the denominator was being counted from audio. It reached their
 * home screen as "0 of 9 PRESENTATIONS" beside "9 of 1 SOLD".
 *
 * Sold exceeding presentations is not a definition preference. It is a broken denominator.
 *
 * WHY THIS FUNCTION WAS WRONG UNTIL NOW. It defaulted to recorded pitches and flagged the choice
 * as awaiting the founder, because it was written from the build guide — which predates the
 * decision and says "confirm with John before building". John confirmed, in production, three
 * months later and with numbers in front of him. The guide was not wrong; it was old, and
 * treating a written question as still-open without checking the record is the §0.1 failure:
 * the answer was in the working tree.
 *
 * Worse than merely wrong: with the old default, the Pitch Score boards and the Door Log's own
 * KPI bubbles would have shown DIFFERENT presentation counts for the same rep on the same day,
 * in the same product. Two definitions of one decision (§2.2), one per screen.
 *
 * The switch survives so a future reversal is one argument rather than a rewrite — the founder
 * has changed this once already on evidence, and may again.
 */
export function countPresentations(args: {
  /** doors_knocked − no_answer, from rep_kpi_daily. The founder's 2026-09-11 definition. */
  doorsSpokenTo: number;
  /** Kept so the reversed definition remains one argument away, not a rewrite. */
  recordedPitches?: number;
  source?: "doors_spoken_to" | "recorded_pitches";
}): number {
  return (args.source ?? "doors_spoken_to") === "recorded_pitches"
    ? args.recordedPitches ?? 0
    : args.doorsSpokenTo;
}

export function computeActivityKpis(args: {
  doorsKnocked: number;
  /** doors_knocked − no_answer. See countPresentations for why this, and not recorded pitches. */
  doorsSpokenTo: number;
  sold: number;
  recordedPitches?: number;
  presentationsSource?: "doors_spoken_to" | "recorded_pitches";
}): ActivityKpis {
  const presentations = countPresentations({
    doorsSpokenTo: args.doorsSpokenTo,
    recordedPitches: args.recordedPitches,
    source: args.presentationsSource,
  });

  return {
    doorsKnocked: args.doorsKnocked,
    presentations,
    sold: args.sold,
    // Null rather than 0 when the denominator is empty: "no doors knocked yet" and "knocked doors,
    // converted none" are different facts, and a 0% badge on a rep's first morning is a lie.
    doorToPresentationRate: args.doorsKnocked > 0 ? r3(presentations / args.doorsKnocked) : null,
    closeRate: presentations > 0 ? r3(args.sold / presentations) : null,
  };
}

/**
 * Roll per-rep aggregates into a team total. Kept separate from aggregatePitches so the launch
 * checklist's "rep totals sum to team totals" is true by construction rather than by coincidence.
 */
export function sumTeamTotals(
  reps: ReadonlyArray<{ totalPoints: number; counted: number; kpis: ActivityKpis }>
): { totalPoints: number; counted: number; doorsKnocked: number; presentations: number; sold: number } {
  return {
    totalPoints: r1(reps.reduce((s, r) => s + r.totalPoints, 0)),
    counted: reps.reduce((s, r) => s + r.counted, 0),
    doorsKnocked: reps.reduce((s, r) => s + r.kpis.doorsKnocked, 0),
    presentations: reps.reduce((s, r) => s + r.kpis.presentations, 0),
    sold: reps.reduce((s, r) => s + r.kpis.sold, 0),
  };
}
