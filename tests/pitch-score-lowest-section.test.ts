/**
 * The LOWEST badge — a re-derivation, and the drift-guard §2.2 requires for one.
 *
 * The authority is `lowestSection` in the web repository (`src/lib/coach/pitchScore/rubric.ts`,
 * lines 227-242, read 2026-09-22). This app cannot import it and the server does not return the
 * verdict, so the rule is mirrored here. §2.2 allows that only when unavoidable, and only with "a
 * drift-guard test exercising BOTH branches of every term".
 *
 * Four terms, so four pairs below. Each pair is written so the WRONG implementation passes one case
 * and fails the other — a test that only exercised the agreeing case would prove nothing, which is
 * exactly how the band-table duplicate survived two passing tests on the web.
 *
 * The oracle is the mockups. `LOGIC-AND-CONTRADICTIONS.md` §A recomputed twenty-four arithmetic
 * identities across all three datasets and all reconcile, which is why their numbers can settle a
 * rule even though their content is sample data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lowestSection, type RubricSection } from '@/lib/pitch-score/rubric';
import type { SectionId } from '@/lib/pitch-score/types';

/**
 * Sum to one decimal, which is how the boards print these figures.
 *
 * Exact float equality was the first version and it failed on real mockup data: Humza's six
 * sections add to 61.99999999999999, not 62. The rule under test was correct; the assertion about
 * it was not. Rounding to the printed precision is the honest comparison, because one decimal is
 * the claim the board actually makes.
 */
const sum1 = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;
/** The rubric's six sections, in its own order. Maxima sum to 100. */
const SECTIONS: RubricSection[] = [
  { id: 'introduction', label: 'Introduction', maxPoints: 12 },
  { id: 'discovery', label: 'Discovery', maxPoints: 16 },
  { id: 'consulting', label: 'Consulting', maxPoints: 14 },
  { id: 'close', label: 'Close', maxPoints: 15 },
  { id: 'transitions', label: 'Transitions', maxPoints: 8 },
  { id: 'delivery', label: 'Delivery', maxPoints: 35 },
];

test('the sections used as the oracle sum to the base maximum', () => {
  // If this drifts, every ratio below is measured against the wrong denominator.
  assert.equal(sum1(SECTIONS.map((s) => s.maxPoints)), 100);
});

/* ── TERM 1: ratio, not points ──────────────────────────────────────────────────────────────── */

test('TERM 1a — the team board: Close is badged though Transitions has fewer points', () => {
  /*
    THE CASE THE NAIVE BUILD FAILS, taken off `Coach Assessment — manager dashboard (web).pdf`,
    opened at full resolution. Transitions 4.7 is the lowest absolute score on the board; the LOWEST
    badge sits on Close 8.6, because 8.6/15 = 57.3% is below 4.7/8 = 58.8%.
  */
  const team: Record<SectionId, number> = {
    introduction: 9.8,
    discovery: 11.5,
    consulting: 8.9,
    close: 8.6,
    transitions: 4.7,
    delivery: 23.9,
  };
  assert.equal(sum1(SECTIONS.map((s) => team[s.id])), 67.4); // the board's printed avg base
  assert.equal(lowestSection(team, SECTIONS), 'close');
  // And the trap, stated as arithmetic: fewest POINTS would have answered transitions.
  const fewestPoints = SECTIONS.reduce((a, b) => (team[a.id] <= team[b.id] ? a : b)).id;
  assert.equal(fewestPoints, 'transitions');
  assert.notEqual(fewestPoints, lowestSection(team, SECTIONS));
});

test('TERM 1b — the rep board: the two rules agree, and the test still passes', () => {
  /*
    The other branch. On `EloState Rep Pitch Dashboard.pdf` p2 the badged section is Close 8.4/15 =
    56.0%, which is ALSO the fewest points. A rule checked only against this dataset would look
    correct while being wrong, which is why 1a exists.
  */
  const rep: Record<SectionId, number> = {
    introduction: 9.8,
    discovery: 11.2,
    consulting: 10.1,
    close: 8.4,
    transitions: 4.6,
    delivery: 24.8,
  };
  assert.equal(sum1(SECTIONS.map((s) => rep[s.id])), 68.9); // the board's printed BASE SCORE
  assert.equal(lowestSection(rep, SECTIONS), 'close');
});

test('TERM 1c — a rep whose lowest section is neither of those', () => {
  /*
    Humza Khan's panel on the manager board: Introduction 6.2/12 = 51.7% is his lowest ratio, and the
    reps table prints "LOWEST SECTION: Introduction" — while his lowest POINTS are Transitions 4.8.
    A third independent confirmation, on a different rep, of the same inversion.
  */
  const humza: Record<SectionId, number> = {
    introduction: 6.2,
    discovery: 11.5,
    consulting: 8.4,
    close: 8.7,
    transitions: 4.8,
    delivery: 22.4,
  };
  assert.equal(sum1(SECTIONS.map((s) => humza[s.id])), 62.0); // his printed avg base
  assert.equal(lowestSection(humza, SECTIONS), 'introduction');
});

/* ── TERM 2: the rubric's own section order ─────────────────────────────────────────────────── */

test('TERM 2 — order comes from the rubric, so both copies resolve a tie identically', () => {
  const tied: Record<SectionId, number> = {
    introduction: 6, // 50%
    discovery: 8, // 50%
    consulting: 14,
    close: 15,
    transitions: 8,
    delivery: 35,
  };
  // Rubric order puts introduction first, so it wins the tie.
  assert.equal(lowestSection(tied, SECTIONS), 'introduction');
  // Reverse the order and the OTHER tied section wins — proving order is load-bearing, not
  // incidental, and that this copy takes it from the data rather than from a local constant.
  assert.equal(lowestSection(tied, [...SECTIONS].reverse()), 'discovery');
});

/* ── TERM 3: strict less-than ───────────────────────────────────────────────────────────────── */

test('TERM 3 — a tie keeps the earlier section, as the authority does', () => {
  /*
    The authority uses `<`. A `<=` here would keep the LATER section and disagree the first time two
    sections tie — silently, and only then. This is the exact shape §2.2 calls drift.
  */
  const tied: Record<SectionId, number> = {
    introduction: 3, // 25%
    discovery: 4, // 25%
    consulting: 14,
    close: 15,
    transitions: 8,
    delivery: 35,
  };
  assert.equal(lowestSection(tied, SECTIONS), 'introduction');
});

/* ── TERM 4: an absent section is skipped, not scored zero ──────────────────────────────────── */

test('TERM 4a — a section with no average is skipped rather than badged', () => {
  /*
    Unknown is not "worst". Treating an absent average as zero would badge a section nobody measured
    — the confident-zero failure this product keeps finding, here aimed at the one label a rep is
    told to work on next.
  */
  const partial: Partial<Record<SectionId, number>> = {
    introduction: 9.8,
    close: 8.4,
    // discovery, consulting, transitions, delivery absent
  };
  assert.equal(lowestSection(partial, SECTIONS), 'close');
});

test('TERM 4b — every section absent yields null, not a section', () => {
  assert.equal(lowestSection({}, SECTIONS), null);
  assert.equal(lowestSection({ close: 8.4 }, []), null);
});

test('TERM 4c — a zero MAXIMUM is skipped, which the authority never has to handle', () => {
  /*
    The web's maxima are constants it owns; here they arrive over the wire. Without this guard a
    zero max makes the ratio Infinity, every comparison fails, and the badge lands on whichever
    section happened to be measured last. Not in the authority, and stated as an addition rather
    than passed off as a mirror.
  */
  const sections: RubricSection[] = [
    { id: 'close', label: 'Close', maxPoints: 0 },
    { id: 'transitions', label: 'Transitions', maxPoints: 8 },
  ];
  assert.equal(lowestSection({ close: 5, transitions: 7 }, sections), 'transitions');
});

test('a zero score is a real answer and still wins the badge', () => {
  // The opposite of TERM 4a: absent means unknown, but zero means measured-and-nothing.
  const zeroed: Record<SectionId, number> = {
    introduction: 9.8,
    discovery: 11.2,
    consulting: 10.1,
    close: 0,
    transitions: 4.6,
    delivery: 24.8,
  };
  assert.equal(lowestSection(zeroed, SECTIONS), 'close');
});
