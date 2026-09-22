/**
 * The Breakdown board's rules, checked against the mockup's own arithmetic.
 *
 * The oracle is `EloState Rep Pitch Dashboard.pdf` p2, opened at full resolution 2026-09-22. Its
 * numbers reconcile — `LOGIC-AND-CONTRADICTIONS.md` §A recomputed twenty-four identities across all
 * three datasets — so where the prose is silent the figures can settle a rule. They are sample data
 * as CONTENT and a valid oracle as ARITHMETIC, and only the second use is made here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  biggestOpportunity,
  elementsForSection,
  opportunityAcrossPeriod,
  reconciliation,
  sectionRows,
  sectionsSumToBase,
  violationRows,
} from '@/lib/pitch-score/breakdown-view';
import type { RubricSection, RubricViolation } from '@/lib/pitch-score/rubric';
import type { ElementStat, PeriodAggregate, SectionId, ViolationStat } from '@/lib/pitch-score/types';

const SECTIONS: RubricSection[] = [
  { id: 'introduction', label: 'Introduction', maxPoints: 12 },
  { id: 'discovery', label: 'Discovery', maxPoints: 16 },
  { id: 'consulting', label: 'Consulting', maxPoints: 14 },
  { id: 'close', label: 'Close', maxPoints: 15 },
  { id: 'transitions', label: 'Transitions', maxPoints: 8 },
  { id: 'delivery', label: 'Delivery', maxPoints: 35 },
];

/** p2's BASE SCORE bars, read off the board. */
const AVERAGES: Record<SectionId, number> = {
  introduction: 9.8,
  discovery: 11.2,
  consulting: 10.1,
  close: 8.4,
  transitions: 4.6,
  delivery: 24.8,
};

/** p2's expanded Close card: five elements, each out of 3, summing to the section's 8.4. */
const CLOSE_ELEMENTS: ElementStat[] = [
  el('close.qualification', 'close', 'Catch: qualification', 3, 2.4, 0.72, 0.16, 0.12),
  el('close.deposit', 'close', 'Catch: deposit', 3, 1.9, 0.5, 0.27, 0.23),
  el('close.simple', 'close', 'Simple close', 3, 1.8, 0.44, 0.32, 0.24),
  el('close.options', 'close', 'Options close', 3, 1.5, 0.33, 0.34, 0.33),
  el('close.paperwork', 'close', 'Into paperwork', 3, 0.8, 0.17, 0.2, 0.63),
];

function el(
  elementId: string,
  section: SectionId,
  label: string,
  maxPoints: number,
  avgPoints: number,
  hitRate: number,
  partialRate: number,
  missedRate: number,
): ElementStat {
  return { elementId, section, label, maxPoints, avgPoints, hitRate, partialRate, missedRate, gradedIn: 18 };
}

test('the six bars come back in the rubric’s order, not the object’s', () => {
  // Key order in a JSON object is an accident of serialisation; the board's order is the order a
  // pitch happens in, which is a design decision.
  const rows = sectionRows(AVERAGES, SECTIONS);
  assert.deepEqual(
    rows.map((r) => r.id),
    ['introduction', 'discovery', 'consulting', 'close', 'transitions', 'delivery'],
  );
});

test('the bars sum to the BASE SCORE printed above them', () => {
  // The launch checklist's first identity: "sections sum to base". p2 prints 68.9.
  const rows = sectionRows(AVERAGES, SECTIONS);
  assert.equal(sectionsSumToBase(rows, 68.9), true);
  // And it catches a base that does not match, rather than accepting any number.
  assert.equal(sectionsSumToBase(rows, 70.0), false);
});

test('exactly one bar is badged LOWEST, and it is Close', () => {
  const rows = sectionRows(AVERAGES, SECTIONS);
  assert.equal(rows.filter((r) => r.lowest).length, 1);
  assert.equal(rows.find((r) => r.lowest)?.id, 'close');
});

test('a bar cannot overrun its track', () => {
  // A manager override can lift a section above its own maximum. The number stays honest; the bar
  // stops at full, because a bar drawn past 100% reads as a rendering fault rather than a high score.
  const over = sectionRows({ ...AVERAGES, close: 17 }, SECTIONS);
  assert.equal(over.find((r) => r.id === 'close')?.fraction, 1);
  assert.equal(over.find((r) => r.id === 'close')?.points, 17);
});

test('BIGGEST OPPORTUNITY is the mockup’s: Into paperwork, 2.2 points a pitch', () => {
  /*
    p2: "Into paperwork: averaging 0.8 of 3 — Hitting it every pitch adds 2.2 points per pitch,
    about +40 points across your 18 pitches this week." Both figures are reproduced here from the
    element stats alone, which is what makes them checkable rather than transcribed.
  */
  const opp = biggestOpportunity(CLOSE_ELEMENTS);
  assert.equal(opp?.label, 'Into paperwork');
  assert.equal(opp?.avgPoints, 0.8);
  assert.equal(opp?.maxPoints, 3);
  assert.equal(opp?.gainPerPitch, 2.2);
  assert.equal(opportunityAcrossPeriod(2.2, 18), 40); // 39.6 → 40, as printed
});

test('it ranks by UNEARNED POINTS, not by miss rate', () => {
  /*
    THE DISTINCTION THE CARD EXISTS FOR. A 1-point element missed every single time is a worse HIT
    RATE than an 8-point element missed half the time, and a hit-rate ranking would put the
    1-pointer on top — true, and worth a tenth as much to the rep.
  */
  const stats: ElementStat[] = [
    el('tiny', 'introduction', 'Always missed, worth little', 1, 0, 0, 0, 1),
    el('big', 'delivery', 'Half missed, worth a lot', 8, 4, 0.5, 0, 0.5),
  ];
  const opp = biggestOpportunity(stats);
  assert.equal(opp?.elementId, 'big', 'the 8-pointer leaves 4 on the table; the 1-pointer leaves 1');
  assert.equal(opp?.gainPerPitch, 4);
  // And the hit-rate ranking, stated so the contrast is explicit rather than implied.
  const worstHitRate = stats.reduce((a, b) => (a.hitRate <= b.hitRate ? a : b));
  assert.equal(worstHitRate.elementId, 'tiny');
});

test('a fully-earned element is never offered as an opportunity', () => {
  // Nothing left on the table is not an opportunity; it is a compliment, and the card is not for
  // compliments. Null rather than a zero-gain row.
  const perfect: ElementStat[] = [el('done', 'close', 'Already full', 3, 3, 1, 0, 0)];
  assert.equal(biggestOpportunity(perfect), null);
  assert.equal(biggestOpportunity([]), null);
});

test('the footer reconciles, and it is checked rather than printed', () => {
  /*
    "68.9 base + 14.6 bonus − 3.2 = 80.3 avg" [OBSERVED, p2]. The launch checklist demands this hold
    for every period. Printing the sum without checking it would make the one line that proves the
    board into the one line that hides a broken one.
  */
  const agg = aggregate({ avgBase: 68.9, avgBonus: 14.6, avgViolations: 3.2, avgPitchScore: 80.3 });
  const rec = reconciliation(agg);
  assert.equal(rec.computed, 80.3);
  assert.equal(rec.reported, 80.3);
  assert.equal(rec.holds, true);
});

test('floating point does not make a correct period look broken', () => {
  /*
    A CORRECTION TO THIS TEST'S FIRST VERSION, kept because the mistake is the interesting part.
    It asserted that 68.9 + 14.6 − 3.2 was 80.30000000000001 and therefore needed rounding. It is
    not — that sum is exact in JS, as are all four reconciliations on the three mockups. I stated a
    float value without computing it, which is the same shape as reading a filename and describing
    the file.

    The rounding is still load-bearing, for a case that IS inexact and was measured: Humza Khan's
    six sections on the manager board sum to 61.99999999999999, not 62. So the guard belongs on
    sectionsSumToBase, and this test now proves it there rather than asserting a fiction here.
  */
  const humza = [6.2, 11.5, 8.4, 8.7, 4.8, 22.4];
  assert.notEqual(humza.reduce((a, b) => a + b, 0), 62, 'this is the sum that is genuinely inexact');
  const rows = sectionRows(
    { introduction: 6.2, discovery: 11.5, consulting: 8.4, close: 8.7, transitions: 4.8, delivery: 22.4 },
    SECTIONS,
  );
  assert.equal(sectionsSumToBase(rows, 62.0), true, 'rounded to the printed precision, it holds');

  // And the reconciliation still holds on the rep board's own figures.
  const rec = reconciliation(
    aggregate({ avgBase: 68.9, avgBonus: 14.6, avgViolations: 3.2, avgPitchScore: 80.3 }),
  );
  assert.equal(rec.holds, true);
});

test('a period that genuinely does not add up is caught', () => {
  // The case the assertion exists for: the parts and the total disagree by more than rounding.
  const rec = reconciliation(
    aggregate({ avgBase: 68.9, avgBonus: 14.6, avgViolations: 3.2, avgPitchScore: 77.0 }),
  );
  assert.equal(rec.holds, false);
  assert.equal(rec.computed, 80.3);
  assert.equal(rec.reported, 77);
});

test('a clean violation is SHOWN as a zero row, not dropped', () => {
  /*
    p2 renders "Rude or dismissive · None · 0". That row is the most valuable one on the card — the
    rep being told they did not do the worst thing on the list. Hiding empty rows would convert
    "you were never rude" into no information at all.

    Driven by the RUBRIC's list, because a violation that never occurred may be absent from the
    stats entirely — and absent is exactly the row worth printing.
  */
  const rubric: RubricViolation[] = [
    { id: 'viol.talkingOver', label: 'Talking over customer', deduction: 2, trigger: '' },
    { id: 'viol.rude', label: 'Rude or dismissive', deduction: 10, trigger: '' },
  ];
  const stats: ViolationStat[] = [
    { violationId: 'viol.talkingOver', label: 'Talking over customer', rate: 0.7, avgDeduction: 1.4 },
  ];
  const rows = violationRows(stats, rubric);
  assert.equal(rows.length, 2, 'every rubric violation gets a row');
  assert.equal(rows[1].violationId, 'viol.rude');
  assert.equal(rows[1].clean, true);
  assert.equal(rows[1].avgDeduction, 0);
  assert.equal(rows[0].clean, false);
  assert.equal(rows[0].avgDeduction, 1.4);
});

test('the deduction is a positive magnitude — the minus belongs to the display', () => {
  // Same convention as every other stat on the board. A negative stored here would print "−−1.4"
  // the first time someone adds the sign in the component, which is how double-negation ships.
  const rows = violationRows(
    [{ violationId: 'v', label: 'V', rate: 0.2, avgDeduction: 1.1 }],
    [{ id: 'v', label: 'V', deduction: 5, trigger: '' }],
  );
  assert.ok(rows[0].avgDeduction > 0);
});

test('the expanded section shows its own elements, summing to its bar', () => {
  const rows = elementsForSection([...CLOSE_ELEMENTS, el('x', 'delivery', 'Elsewhere', 4, 2, 0.5, 0, 0.5)], 'close');
  assert.equal(rows.length, 5);
  const sum = Math.round(rows.reduce((n, r) => n + r.avgPoints, 0) * 10) / 10;
  assert.equal(sum, 8.4); // the Close bar on p2
});

function aggregate(p: Partial<PeriodAggregate>): PeriodAggregate {
  return {
    pitchesTotal: 23,
    counted: 18,
    notCounted: 5,
    notCountedReasons: {},
    totalPoints: 1445,
    avgPitchScore: 80.3,
    avgBase: 68.9,
    avgBonus: 14.6,
    avgViolations: 3.2,
    bestPitchScore: 106.5,
    sectionAverages: AVERAGES,
    elementStats: [],
    bonusStats: [],
    violationStats: [],
    prizeEligible: true,
    ...p,
  };
}
