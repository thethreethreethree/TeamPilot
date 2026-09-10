/**
 * The odometer's digits.
 *
 * Spec §2 wants the total as grouped digits rather than a plain number, matching the web, which draws each digit
 * in its own tile. The rule is here so the screen only has to draw boxes — and so the inputs a server can actually
 * send are tested rather than assumed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { odometerChars } from '@/lib/gamification/odometer';

const render = (n: number) => odometerChars(n).map((c) => c.char).join('');

test('a three-figure total is three digit tiles', () => {
  const chars = odometerChars(548);
  assert.equal(chars.length, 3);
  assert.ok(chars.every((c) => c.kind === 'digit'));
  assert.equal(render(548), '548');
});

test('a thousands separator is marked as one, so it is drawn narrow and without a tile', () => {
  const chars = odometerChars(1234);
  assert.deepEqual(
    chars.map((c) => c.kind),
    ['digit', 'separator', 'digit', 'digit', 'digit'],
  );
  assert.equal(render(1234), '1,234');
});

test('grouping matches the rest of the app, so 1,234 reads the same everywhere', () => {
  // A second grouping rule would be a second answer to the same question.
  assert.equal(render(1234567), '1,234,567');
});

test('a fractional total is rounded, never shown with a point', () => {
  // Points arrive summed from a ledger and corrections can be fractional. An
  // odometer with a decimal point in it is not an odometer.
  assert.equal(render(89.6), '90');
  assert.equal(render(89.4), '89');
});

test('a negative total keeps its sign as a tile rather than losing it', () => {
  // A corrected rep can go below zero. Dropping the minus would show them a
  // total that is wrong by twice its own value.
  assert.equal(render(-12), '-12');
});

test('zero is one tile, not none', () => {
  assert.equal(render(0), '0');
  assert.equal(odometerChars(0).length, 1);
});

test('a non-finite total gives a single zero, never the letters N, a, N', () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(render(bad), '0', `rendered something odd for ${bad}`);
  }
});
