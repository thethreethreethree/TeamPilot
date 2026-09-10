/**
 * The day's door target, and the cash box the 10 September update added.
 *
 * The worked example is the whole point of the first test: the spec says it must
 * give 80 doors, "not 79". Rounding down at any step hands a rep a target that
 * cannot reach the goal, and a single misplaced `Math.round` produces 79 while
 * looking entirely correct in review.
 *
 * The cash tests pin the case that would actually hurt somebody: a rep who sold
 * two houses being shown "$0" because no manager has set a value per sale.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DOORS_CEILING,
  DOORS_FLOOR,
  calculateDayTarget,
  cashBox,
  dialFill,
  money,
  salesToGoalText,
  targetSentence,
} from '@/lib/doors/day-target';

test("the spec's worked example gives 18 and 80 — not 79", () => {
  const t = calculateDayTarget({
    salesGoal: 2,
    closeRatio: null,
    contactRatio: null,
    qualified: false,
  });
  assert.equal(t.soldTarget, 2);
  assert.equal(t.presentationsTarget, 18);
  assert.equal(t.doorsTarget, 80, 'rounding slipped — this is the number the spec calls out');
  assert.equal(t.usedStarter, true);
});

test('a rep with no goal set gets no target, never an invented one', () => {
  const t = calculateDayTarget({ salesGoal: 0, closeRatio: 0.2, contactRatio: 0.3, qualified: true });
  assert.deepEqual(t, {
    doorsTarget: 0,
    presentationsTarget: 0,
    soldTarget: 0,
    usedStarter: true,
  });
});

test('a qualified rep uses their OWN ratios', () => {
  const t = calculateDayTarget({ salesGoal: 2, closeRatio: 0.5, contactRatio: 0.5, qualified: true });
  assert.equal(t.presentationsTarget, 4);
  assert.equal(t.usedStarter, false);
});

test('an unqualified rep falls back to starter even with ratios present', () => {
  const t = calculateDayTarget({ salesGoal: 2, closeRatio: 0.5, contactRatio: 0.5, qualified: false });
  assert.equal(t.presentationsTarget, 18, 'unqualified ratios were trusted');
  assert.equal(t.usedStarter, true);
});

test('a zero or absurd ratio never divides by zero', () => {
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
    const t = calculateDayTarget({
      salesGoal: 2,
      closeRatio: bad as number | null,
      contactRatio: bad as number | null,
      qualified: true,
    });
    assert.ok(Number.isFinite(t.doorsTarget), `ratio ${bad} produced a non-finite target`);
    assert.equal(t.usedStarter, true);
  }
});

test('the door number is clamped at both ends', () => {
  const tiny = calculateDayTarget({ salesGoal: 1, closeRatio: 0.9, contactRatio: 0.9, qualified: true });
  assert.equal(tiny.doorsTarget, DOORS_FLOOR);
  const huge = calculateDayTarget({ salesGoal: 500, closeRatio: null, contactRatio: null, qualified: false });
  assert.equal(huge.doorsTarget, DOORS_CEILING);
});

test('a dial fills proportionally and stops at full — no second lap', () => {
  assert.equal(dialFill(40, 80), 0.5);
  assert.equal(dialFill(95, 80), 1, 'overshoot ran round the ring again');
  assert.equal(dialFill(5, 0), 0, 'an absent target drew a full ring');
  assert.equal(dialFill(-3, 80), 0);
});

// ---------------------------------------------------------------------------
// The cash box
// ---------------------------------------------------------------------------

test("the spec's cash example: 1 sold at $185, target 2", () => {
  const box = cashBox(1, 2, 18500);
  assert.equal(box.kind, 'money');
  if (box.kind !== 'money') return;
  assert.equal(money(box.earnedCents), '$185');
  assert.equal(money(box.toGoalCents), '$185');
  assert.equal(box.goalMet, false);
});

test('NO value per sale falls back to counting sales, never to $0', () => {
  // The failure that would matter: a rep who sold two houses shown "$0" because
  // nobody set a per-sale value.
  for (const unset of [null, undefined, 0, -1, Number.NaN]) {
    const box = cashBox(2, 3, unset as number | null);
    assert.equal(box.kind, 'sales', `perSale ${unset} produced a money box`);
    if (box.kind !== 'sales') return;
    assert.equal(box.remaining, 1);
  }
});

test('goal met is only ever claimed against a real goal', () => {
  assert.equal(cashBox(2, 2, 18500).goalMet, true);
  // Target 0 means no goal exists, so "goal met" would be a claim about a goal
  // nobody set.
  assert.equal(cashBox(0, 0, 18500).goalMet, false);
  assert.equal(cashBox(5, 0, null).goalMet, false);
});

test('money reads as a manager says it', () => {
  assert.equal(money(18500), '$185');
  assert.equal(money(18550), '$185.50');
  assert.equal(money(123456789), '$1,234,567.89');
  assert.equal(money(0), '$0');
  assert.equal(money(Number.NaN), '$0');
});

test('the sales-to-goal line is singular when it should be', () => {
  assert.equal(salesToGoalText(1, false), '1 more sale to goal');
  assert.equal(salesToGoalText(3, false), '3 more sales to goal');
  assert.equal(salesToGoalText(0, true), 'Goal met');
  assert.equal(salesToGoalText(0, false), 'No goal set yet');
});

test('the target sentence speaks in ratios a person uses, not decimals', () => {
  const s = targetSentence(null, null, 2, 80, true);
  assert.match(s, /1 sale per 9 presentations/);
  assert.match(s, /1 presentation per 4\.4 doors/);
  assert.match(s, /To land 2 sales today, knock 80 doors/);
  // A decimal ratio must never reach the rep.
  assert.ok(!/0\.1{2,}/.test(s), 'a raw ratio leaked into the sentence');
});
