/**
 * Regression tests for the display edge.
 *
 * These exist because both functions below shipped wrong once, in ways no gate
 * would have caught:
 *
 *   money()    — the build plan's own architecture documents describe deal_value
 *                as "integer minor units". It is numeric(14, 2), an exact decimal
 *                in MAJOR units, served by PostgREST as a string. Treating it as
 *                minor units rendered a $1,500.00 deal as $15.00.
 *
 *   duration() — a session_kind of 'meeting' can run past an hour, and the first
 *                version rendered 3661 seconds as "61m 1s".
 *
 * Run with `npm test`. No test framework is installed: node:test and native
 * TypeScript stripping are enough, and a dependency for this would be cost
 * without benefit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { badgeDay, count, duration, money, outcomeLabel, parseMoney } from '@/lib/format';

test('money: a numeric(14,2) string is major units, not minor', () => {
  // The exact bug. Anything that makes this assertion fail is a 100x error.
  assert.equal(money('1500.00'), '$1,500');
  assert.equal(money('1500.50'), '$1,500.50');
  assert.equal(money('1234567.89'), '$1,234,567.89');
});

test('money: accepts a number as well as a string', () => {
  assert.equal(money(1500), '$1,500');
  assert.equal(money(1500.5), '$1,500.50');
});

test('money: whole amounts drop the trailing .00', () => {
  assert.equal(money('0.00'), '$0');
  assert.equal(money('42.00'), '$42');
});

test('money: no floating-point drift reaches the screen', () => {
  assert.equal(money('0.10'), '$0.10');
  assert.equal(money('0.30'), '$0.30');
  // Formatted from the string, so a third decimal is cut, never rounded up.
  assert.equal(money('1.999'), '$1.99');
});

test('money: absent and unparseable values render nothing, not zero', () => {
  // Rendering "$0" for a missing deal value would be an invented business fact.
  assert.equal(money(null), null);
  assert.equal(money(undefined), null);
  assert.equal(money(''), null);
  assert.equal(money('abc'), null);
});

test('money: negatives keep their sign', () => {
  assert.equal(money('-250.00'), '-$250');
});

test('duration: carries hours for a long meeting', () => {
  assert.equal(duration(3661), '1h 1m');
  assert.equal(duration(3600), '1h');
  assert.equal(duration(7325), '2h 2m');
});

test('duration: minutes and seconds below the hour', () => {
  assert.equal(duration(45), '45s');
  assert.equal(duration(90), '1m 30s');
});

test('duration: no recording means no duration, not "0s"', () => {
  assert.equal(duration(null), null);
  assert.equal(duration(0), null);
});

test('outcomeLabel: states the fact, never a verdict', () => {
  // Asset A11 — the app surfaces what happened; the rep renders the judgement.
  // "No sale" is a fact. "Failed" or "Missed" would not be ours to say.
  assert.equal(outcomeLabel('no_sale'), 'No sale');
  assert.equal(outcomeLabel('sold'), 'Sold');
  assert.equal(outcomeLabel('follow_up'), 'Follow-up');
  assert.equal(outcomeLabel(null), 'Not recorded');
});

/* ── parseMoney: reading what a rep types ──────────────────────────────── */

test('parseMoney: reads the forms a rep actually types', () => {
  // The server takes MAJOR units — the column is numeric(14,2), so 1500 means
  // $1,500.00. This project has already had one 100x bug of exactly this shape.
  assert.equal(parseMoney('1500'), 1500);
  assert.equal(parseMoney('1,500'), 1500);
  assert.equal(parseMoney('$1,500'), 1500);
  assert.equal(parseMoney('$1500.00'), 1500);
  assert.equal(parseMoney(' 1 500 '), 1500);
});

test('parseMoney: keeps cents', () => {
  assert.equal(parseMoney('1500.50'), 1500.5);
  assert.equal(parseMoney('0.99'), 0.99);
});

test('parseMoney: blank means absent, not zero', () => {
  // Zero is a claim — that the deal was worth nothing. Blank is the absence of
  // a claim, and the two must not collapse into each other.
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('   '), null);
});

test('parseMoney: a real zero is kept', () => {
  assert.equal(parseMoney('0'), 0);
});

test('parseMoney: anything unreadable is absent, never a guess', () => {
  // A misread deal value does not fail loudly. It quietly changes revenue and
  // average deal size, and nobody would know where the number came from.
  for (const input of ['abc', '1.2.3', '12e5', '--5', '1,2,3.4.5', '$', 'NaN', 'Infinity']) {
    assert.equal(parseMoney(input), null, `"${input}" should not parse`);
  }
});

test('parseMoney: a negative amount is refused', () => {
  // The server rejects it (nonnegative), and a minus sign is far more likely a
  // typo than an intention.
  assert.equal(parseMoney('-500'), null);
  assert.equal(parseMoney('$-500'), null);
});

test('parseMoney round-trips through money()', () => {
  // What a rep types, stored, then shown back to them must be the same amount.
  assert.equal(money(parseMoney('$1,500')), '$1,500');
  assert.equal(money(parseMoney('1500.50')), '$1,500.50');
});

test('a total is grouped the same way whatever the phone is set to', () => {
  // ASSERTS THE LOCALE ARGUMENT, not the output. Comparing to '1,240' proves
  // nothing on a machine whose own default is en-US — a bare toLocaleString()
  // passes it too, which is exactly the bug this exists to catch. So spy on the
  // call and require the locale to have been passed explicitly.
  const real = Number.prototype.toLocaleString;
  const seen: unknown[] = [];
  /* eslint-disable no-extend-native -- swapped for the length of this test only,
     and restored in the finally below. Spying on the call is the only way to
     prove the locale was passed: comparing output cannot, on an en-US machine. */
  Number.prototype.toLocaleString = function (this: number, ...args: unknown[]) {
    seen.push(args[0]);
    return real.apply(this, args as []);
  } as typeof real;
  try {
    const out = count(1240);
    assert.equal(out, '1,240');
    assert.deepEqual(seen, ['en-US'], 'count() did not pin its locale');
  } finally {
    Number.prototype.toLocaleString = real;
    /* eslint-enable no-extend-native */
  }
});

test('grouping is applied at every magnitude, and to negatives', () => {
  assert.equal(count(1000000), '1,000,000');
  assert.equal(count(0), '0');
  assert.equal(count(-1240), '-1,240');
});

test('a total below a thousand is not decorated', () => {
  assert.equal(count(80), '80');
  assert.equal(count(999), '999');
});

test('an unreadable total renders as zero rather than "NaN"', () => {
  // A rep seeing "NaN points" learns nothing; a 0 is at least a number, and the
  // screens that must distinguish "none" from "unknown" use an em dash instead.
  assert.equal(count(Number.NaN), '0');
  assert.equal(count(Number.POSITIVE_INFINITY), '0');
});

test('a fractional total is rounded, never shown with a decimal tail', () => {
  assert.equal(count(1240.4), '1,240');
  assert.equal(count(1240.6), '1,241');
});

test('a milestone badge shows the day without a weekday', () => {
  // "Wed 12 Aug" under a hexagon is three words where one date is wanted, and the weekday of a milestone earned
  // four months ago tells a rep nothing.
  const d = badgeDay('2026-08-12T09:00:00Z');
  assert.match(d, /12/);
  assert.match(d, /Aug/i);
  assert.ok(!/wed|mon|tue|thu|fri|sat|sun/i.test(d), `a weekday leaked into the badge date: ${d}`);
});

test('the badge date is pinned to one locale, not the phone', () => {
  // Otherwise two reps on the same team read the same milestone in a different order, and neither can tell which
  // one is "the" format. Day-before-month matches every other date in the app.
  const seen: unknown[] = [];
  const real = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (this: Date, ...args: unknown[]) {
    seen.push(args[0]);
    return real.apply(this, args as Parameters<typeof real>);
  } as typeof real;
  try {
    badgeDay('2026-08-12T09:00:00Z');
  } finally {
    Date.prototype.toLocaleDateString = real;
  }
  assert.deepEqual(seen, ['en-GB'], 'the locale must be passed explicitly, never left to the device');
});

test('an unreadable milestone date renders as nothing, never "Invalid Date"', () => {
  assert.equal(badgeDay('not a date'), '');
});
