/**
 * Milestone earned-dates, spec §5.3.
 *
 * The rule under test is not "parse a date" — it is that THREE states stay apart. "Not yet earned" and "the server
 * did not tell me" look identical if you collapse them, and collapsing them tells a rep who has closed ten deals
 * that they have not. That is the failure this module exists to prevent, so most of these tests are about it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  milestoneLine,
  milestoneStatus,
  readMilestoneDates,
} from '@/lib/gamification/milestone-dates';

const day = (iso: string) => iso;
const fmt = (iso: string) => `day:${iso.slice(0, 10)}`;

test('an earned milestone carries the day it happened', () => {
  const s = milestoneStatus({ spark: '2026-08-12T09:00:00Z' }, 'spark');
  assert.deepEqual(s, { state: 'earned', at: '2026-08-12T09:00:00Z' });
});

test('an explicit null is "not yet" — a real state for a new rep', () => {
  assert.deepEqual(milestoneStatus({ deal: null }, 'deal'), { state: 'not-yet' });
});

test('a MISSING key is unknown, and is NOT reported as unearned', () => {
  // The distinction the module exists for. An older API, a truncated payload, or a badge added after this build
  // must not render as "you have not done this" — a rep with ten deals would be told they had none.
  assert.deepEqual(milestoneStatus({ spark: day('2026-08-12T00:00:00Z') }, 'closer'), { state: 'unknown' });
  assert.deepEqual(milestoneStatus({}, 'spark'), { state: 'unknown' });
  assert.deepEqual(milestoneStatus(null, 'spark'), { state: 'unknown' });
  assert.deepEqual(milestoneStatus(undefined, 'flame'), { state: 'unknown' });
});

test('an unparseable date is unknown, never a badge reading "Invalid Date"', () => {
  assert.deepEqual(milestoneStatus({ spark: 'not a date' as unknown as string }, 'spark'), { state: 'unknown' });
  assert.deepEqual(milestoneStatus({ spark: '' }, 'spark'), { state: 'unknown' });
});

test('readMilestoneDates returns null when the payload has no milestones at all', () => {
  // Distinguishable from "a rep who has earned none", one level up — the same rule as above.
  assert.equal(readMilestoneDates({}), null);
  assert.equal(readMilestoneDates(null), null);
  assert.equal(readMilestoneDates({ milestones: null }), null);
  assert.equal(readMilestoneDates({ milestones: [] }), null, 'an array is not the map this expects');
});

test('readMilestoneDates keeps only the five known keys, and only readable dates', () => {
  const m = readMilestoneDates({
    milestones: {
      spark: '2026-08-12T09:00:00Z',
      flame: null,
      deal: 'rubbish',
      unknown_badge: '2026-01-01T00:00:00Z',
    },
  });
  assert.deepEqual(m, { spark: '2026-08-12T09:00:00Z', flame: null, deal: null });
  assert.ok(m && !('unknown_badge' in m), 'a key this app does not know must not be carried through');
  assert.ok(m && !('closer' in m), 'a key the server omitted stays omitted, so it reads as unknown');
});

test('the line under a badge: the day when earned, the requirement when not', () => {
  assert.equal(milestoneLine({ state: 'earned', at: '2026-08-12T09:00:00Z' }, 'Close one', fmt), 'day:2026-08-12');
  assert.equal(milestoneLine({ state: 'not-yet' }, 'Close one', fmt), 'Close one');
});

test('an unknown milestone says it cannot be checked, not that it is unearned', () => {
  const line = milestoneLine({ state: 'unknown' }, 'Close one', fmt);
  assert.match(line, /can't check/i);
  assert.notEqual(line, 'Close one', 'a badge nobody could check must not read as one not yet earned');
});
