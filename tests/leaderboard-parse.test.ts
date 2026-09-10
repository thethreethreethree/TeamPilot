/**
 * Regression tests for reading the leaderboard's numbers off the wire.
 *
 * THE BUG THIS EXISTS FOR: `total_points` is a Postgres **bigint** and
 * `avg_points` a **numeric**, and PostgREST sends both as STRINGS. The obvious
 * `typeof v === 'number' ? v : 0` therefore reads every total on the board as
 * zero — an entire team showing 0 points, with no error raised anywhere,
 * because a string is not a number and zero looks like a real answer.
 *
 * It is the same shape as every other honesty bug in this build, arriving
 * through a type system that cannot see across the network boundary.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { num } from '@/lib/gamification/leaderboard';

test('a bigint arriving as a STRING reads as its number', () => {
  // The actual failure: total_points comes back as "3604", not 3604.
  assert.equal(num('3604'), 3604);
});

test('a numeric arriving as a string keeps its decimals', () => {
  assert.equal(num('63.2'), 63.2);
});

test('a real number passes through', () => {
  assert.equal(num(57), 57);
  assert.equal(num(0), 0);
});

test('a negative total survives — corrections are real', () => {
  assert.equal(num('-25'), -25);
});

test('nothing usable reads as 0 rather than NaN', () => {
  // NaN would render as "NaN" on screen; 0 is the safe floor for a count.
  assert.equal(num(null), 0);
  assert.equal(num(undefined), 0);
  assert.equal(num('not a number'), 0);
  assert.equal(num({}), 0);
  assert.equal(num(Number.NaN), 0);
  assert.equal(num(Number.POSITIVE_INFINITY), 0);
});

test('an empty string is 0, not NaN', () => {
  assert.equal(num(''), 0);
});
