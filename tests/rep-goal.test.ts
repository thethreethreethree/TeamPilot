/**
 * A manager setting a rep's daily goal and what a sale is worth.
 *
 * THE FIRST TEST IS THE IMPORTANT ONE. `parseMoney` returns DOLLARS, because the
 * deal-value column is major units, and `format.ts` records that this app has
 * already had "one 100x bug from two plan documents describing that column as
 * minor units". `sale_value_cents` is the opposite unit.
 *
 * Get that backwards and nothing fails: every rep in the company is quietly told
 * they earned one hundredth of what their manager set, on a screen that looks
 * entirely correct.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMoney } from '@/lib/format';
import {
  centsToDollarsText,
  dollarsToCents,
  goalPatch,
  goalProblem,
  goalProblemText,
  parseGoal,
} from '@/lib/doors/rep-goal';

const draft = (goalText: string, perSaleText = '') => ({ goalText, perSaleText });

test('$185 typed by a manager reaches the server as 18500 CENTS, not 185', () => {
  const patch = goalPatch('rep-1', draft('2', '185'), parseMoney)!;
  assert.equal(patch.saleValueCents, 18500, 'the 100x unit bug is back');
  assert.equal(patch.salesGoal, 2);
});

test('the conversion survives the shapes a manager actually types', () => {
  for (const [typed, cents] of [
    ['185', 18500],
    ['$185', 18500],
    ['1,500', 150000],
    ['185.50', 18550],
    ['0.99', 99],
  ] as const) {
    const patch = goalPatch('rep-1', draft('2', typed), parseMoney)!;
    assert.equal(patch.saleValueCents, cents, `"${typed}" converted wrong`);
  }
});

test('an EMPTY per-sale clears the value rather than leaving the old one', () => {
  // The column is nullable precisely so "stop showing dollars" is expressible,
  // and clearing it returns the rep's cash box to counting sales, not to $0.
  const patch = goalPatch('rep-1', draft('3', '  '), parseMoney)!;
  assert.equal(patch.saleValueCents, null);
  assert.equal(patch.salesGoal, 3);
});

test('a goal of zero is refused here, because the server refuses it too', () => {
  // The route's schema is int().positive(). Sending 0 would 400 after a round
  // trip; refusing it here tells the manager immediately.
  assert.equal(goalProblem(draft('0'), parseMoney), 'goal-not-positive');
  assert.equal(goalPatch('rep-1', draft('0'), parseMoney), null);
});

test('a goal must be a whole number of sales', () => {
  assert.equal(goalProblem(draft('2.5'), parseMoney), 'goal-not-whole');
  assert.equal(goalProblem(draft('two'), parseMoney), 'goal-not-a-number');
  assert.equal(goalProblem(draft(''), parseMoney), 'goal-missing');
  assert.equal(parseGoal('2.5'), null);
  assert.equal(parseGoal(' 3 '), 3);
});

test('a per-sale that is not an amount is caught before sending', () => {
  assert.equal(goalProblem(draft('2', 'lots'), parseMoney), 'per-sale-not-a-number');
  assert.equal(goalPatch('rep-1', draft('2', 'lots'), parseMoney), null);
});

test('a valid draft with no per-sale is still sendable', () => {
  assert.equal(goalProblem(draft('2'), parseMoney), null);
});

test('cents come back as the dollars a manager typed', () => {
  assert.equal(centsToDollarsText(18500), '185');
  assert.equal(centsToDollarsText(18550), '185.50');
  assert.equal(centsToDollarsText(99), '0.99');
  // Absent stays absent — never "0", which would look like a set value of zero.
  assert.equal(centsToDollarsText(null), '');
  assert.equal(centsToDollarsText(undefined), '');
});

test('a round trip through dollars and back does not drift', () => {
  for (const typed of ['185', '185.50', '1,500', '0.99']) {
    const cents = dollarsToCents(parseMoney(typed) as number);
    const back = centsToDollarsText(cents);
    assert.equal(dollarsToCents(parseMoney(back) as number), cents, `drifted on ${typed}`);
  }
});

test('every problem has words a manager can act on', () => {
  for (const p of [
    'goal-missing',
    'goal-not-a-number',
    'goal-not-whole',
    'goal-not-positive',
    'per-sale-not-a-number',
  ] as const) {
    const text = goalProblemText(p)!;
    assert.ok(text && text.length > 0, `${p} has no message`);
    assert.ok(!/invalid|error/i.test(text), `${p} reads as a system error`);
  }
  assert.equal(goalProblemText(null), null);
});
