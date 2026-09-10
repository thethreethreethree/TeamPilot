/**
 * Reading today's door target off the wire.
 *
 * The fixture below is the ACTUAL production response of 10 September, not the
 * spec's sketch — including `qualified` and `frozen`, two fields the spec does
 * not mention. Building against a documented shape instead of an observed one is
 * what put raw JSON in front of a rep once already.
 *
 * The rule these guard: `salesGoal: null` means NOBODY HAS SET ONE, and must
 * never arrive as a zero. A rep told their goal is zero has been told a fact; a
 * rep told no goal is set has been told to go and ask a manager.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deviceTimeZone, readDayTarget } from '@/lib/doors/day-target-view';

/** Verbatim from production, 10 September. */
const LIVE = {
  localDate: '2026-09-10',
  repName: 'Moses Maniquiz',
  target: {
    doorsTarget: 0,
    presentationsTarget: 0,
    soldTarget: 0,
    usedStarter: true,
    salesGoal: null,
    closeRatio: null,
    contactRatio: null,
    saleValueCents: null,
    qualified: false,
    frozen: false,
  },
  today: { doors: 0, presentations: 0, sold: 0 },
};

test('the real production response is read without loss', () => {
  const v = readDayTarget(LIVE)!;
  assert.equal(v.localDate, '2026-09-10');
  assert.equal(v.repName, 'Moses Maniquiz');
  assert.equal(v.salesGoal, null, 'an unset goal became a number');
  assert.equal(v.saleValueCents, null);
  assert.equal(v.qualified, false);
  assert.equal(v.frozen, false);
  assert.deepEqual(v.today, { doors: 0, presentations: 0, sold: 0 });
});

test('an unset goal stays NULL and never becomes zero', () => {
  // "Your goal is 0" is a fact about a goal. "No goal is set" sends the rep to a
  // manager. They are different screens.
  const v = readDayTarget(LIVE)!;
  assert.notEqual(v.salesGoal, 0);
  assert.equal(v.salesGoal, null);
});

test('a set goal and a set value per sale are read as numbers', () => {
  const v = readDayTarget({
    ...LIVE,
    target: { ...LIVE.target, salesGoal: 2, saleValueCents: 18500, doorsTarget: 80, soldTarget: 2 },
    today: { doors: 12, presentations: 3, sold: 1 },
  })!;
  assert.equal(v.salesGoal, 2);
  assert.equal(v.saleValueCents, 18500);
  assert.equal(v.doorsTarget, 80);
  assert.equal(v.today.sold, 1);
});

test('a malformed payload is rejected rather than half-read', () => {
  for (const bad of [null, undefined, 'nope', {}, { target: null }, 42]) {
    assert.equal(readDayTarget(bad), null, `accepted ${JSON.stringify(bad)}`);
  }
});

test('missing counts read as zero, but missing GOALS read as null', () => {
  // A count genuinely is zero at the start of the day. A goal is not.
  const v = readDayTarget({ target: {}, today: {} })!;
  assert.deepEqual(v.today, { doors: 0, presentations: 0, sold: 0 });
  assert.equal(v.salesGoal, null);
  assert.equal(v.saleValueCents, null);
  assert.equal(v.closeRatio, null);
});

test('usedStarter defaults to TRUE when absent, which is the safe direction', () => {
  // Claiming a rep is on their own proven ratios when we do not know is the
  // wrong way to be wrong: it presents a starter target as a personalised one.
  assert.equal(readDayTarget({ target: {}, today: {} })!.usedStarter, true);
  assert.equal(readDayTarget({ target: { usedStarter: false }, today: {} })!.usedStarter, false);
});

test('the device timezone is a real IANA zone or a safe fallback', () => {
  const tz = deviceTimeZone();
  assert.ok(typeof tz === 'string' && tz.length > 0);
});
