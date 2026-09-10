/**
 * Regression tests for the door log's queue.
 *
 * THE FAILURE HERE IS AN ERASED DOOR, and nothing on screen would show it. A
 * door-to-door rep's entire day is a count; if two knocks share an idempotency
 * key the server deduplicates them into one, and the rep's total is quietly
 * wrong with no error anywhere. So the id collision case is the one that matters
 * most, and it is deliberately tested at the speed a real rep taps: twice in the
 * same millisecond, on a terrace of identical doors.
 *
 * The second failure is a day split in two. A local date built from
 * `toISOString()` files a 9 p.m. knock under tomorrow for every rep west of
 * Greenwich, halving both days. This project has shipped that class of bug once
 * already, so the test derives its case from the runner's real offset rather
 * than from a fixed hour that only fails in some timezones.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addKnock,
  listKnocks,
  removeKnock,
  markKnockFailed,
  undoLastKnock,
  countByOutcome,
  clearKnocks,
  newKnockId,
  localDate,
  __resetKnockSeq,
} from '@/lib/doors/knock-store';

const REP = 'rep-1';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  __resetKnockSeq();
});

test('two knocks in the same millisecond get DIFFERENT ids', () => {
  // The exact shape of the bug: identical doors, fast taps, one clock reading.
  // Sharing an id means the server treats the second as a retry of the first and
  // the rep loses a door with nothing to show for it.
  const ids = new Set<string>();
  const realNow = Date.now;
  try {
    Date.now = () => 1_788_000_000_000;
    for (let i = 0; i < 200; i++) ids.add(newKnockId());
  } finally {
    Date.now = realNow;
  }
  assert.equal(ids.size, 200);
});

test('a knock is recorded with an id, an outcome and a local date', async () => {
  const k = await addKnock(REP, 'sold');
  assert.ok(k.clientKnockId.length > 0);
  assert.equal(k.outcome, 'sold');
  assert.match(k.localDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(k.attempts, 0);
  assert.equal((await listKnocks(REP)).length, 1);
});

test('knocks ACCUMULATE — they are events, never replaced', async () => {
  // The write outbox replaces an instruction for the same call. A knock must
  // never behave that way: five no-answers on one street are five doors.
  for (let i = 0; i < 5; i++) await addKnock(REP, 'no_answer');
  assert.equal((await listKnocks(REP)).length, 5);
});

test('the local date is the rep’s day, not UTC’s', () => {
  const offsetMinutes = new Date().getTimezoneOffset(); // >0 west, <0 east
  if (offsetMinutes === 0) {
    console.log('  (skipped: runner is at UTC, where the two readings coincide)');
    return;
  }
  // A moment that is one local day and a different UTC day, wherever this runs.
  const hour = offsetMinutes > 0 ? 23 : 0;
  const at = new Date(2026, 8, 3, hour, 30);
  assert.notEqual(
    at.toISOString().slice(0, 10),
    localDate(at),
    'test setup failed to straddle the UTC date line',
  );
  assert.equal(localDate(at), '2026-09-03');
});

test('a confirmed knock leaves the queue; the others stay', async () => {
  const a = await addKnock(REP, 'sold');
  await addKnock(REP, 'no_answer');
  await removeKnock(REP, a.clientKnockId);
  const left = await listKnocks(REP);
  assert.equal(left.length, 1);
  assert.equal(left[0].outcome, 'no_answer');
});

test('a failed send counts an attempt and KEEPS the knock', async () => {
  const k = await addKnock(REP, 'go_back');
  await markKnockFailed(REP, k.clientKnockId, 'no signal');
  const [row] = await listKnocks(REP);
  // Giving up is never the same as throwing away — a lost knock is a lost door.
  assert.equal(row.attempts, 1);
  assert.equal(row.lastError, 'no signal');
  assert.equal((await listKnocks(REP)).length, 1);
});

test('undo takes back only the last WAITING knock', async () => {
  await addKnock(REP, 'no_answer');
  const second = await addKnock(REP, 'sold');
  const undone = await undoLastKnock(REP);
  assert.equal(undone?.clientKnockId, second.clientKnockId);
  const left = await listKnocks(REP);
  assert.equal(left.length, 1);
  assert.equal(left[0].outcome, 'no_answer');
});

test('undo on an empty queue is not an error', async () => {
  assert.equal(await undoLastKnock(REP), null);
});

test('today is counted per outcome, from the queue alone', async () => {
  await addKnock(REP, 'no_answer');
  await addKnock(REP, 'no_answer');
  await addKnock(REP, 'sold');
  const today = localDate();
  const counts = countByOutcome(await listKnocks(REP), today);
  assert.equal(counts.no_answer, 2);
  assert.equal(counts.sold, 1);
  assert.equal(counts.go_back, 0);
});

test('yesterday’s knocks are not counted as today’s', async () => {
  await addKnock(REP, 'sold');
  const rows = await listKnocks(REP);
  const counts = countByOutcome(rows, '1999-01-01');
  assert.equal(counts.sold, 0);
});

test('one rep never sees another rep’s doors', async () => {
  await addKnock(REP, 'sold');
  assert.equal((await listKnocks('rep-2')).length, 0);
});

test('sign-out clears them', async () => {
  await addKnock(REP, 'sold');
  await clearKnocks(REP);
  assert.equal((await listKnocks(REP)).length, 0);
});

test('a corrupt queue reads as empty rather than throwing', async () => {
  await AsyncStorage.setItem(`knocks.v1.${REP}`, '{not json');
  assert.deepEqual(await listKnocks(REP), []);
  // And a knock after that still works — a bad read must not brick the day.
  await addKnock(REP, 'sold');
  assert.equal((await listKnocks(REP)).length, 1);
});

test('signing out does NOT throw away a day of doors', async () => {
  // This was briefly wrong in the real code: knocks were added to the sign-out
  // sweep alongside the caches. That sweep runs at the exact moment a rep taps
  // "sign out" at the end of a working day, so it would have deleted every door
  // that had not yet reached the server — silently, and with no way back.
  //
  // A knock is not a copy of anything. Like an unsent recording, the phone is
  // the only place it exists.
  const { sweepDeviceCopies } = await import('@/lib/sign-out-flow');
  await addKnock(REP, 'sold');
  await addKnock(REP, 'no_answer');

  await sweepDeviceCopies(REP);

  assert.equal((await listKnocks(REP)).length, 2);
});

test('signing out clears a cached preference but NOT an unsent one', async () => {
  // Same rule as the doors above, applied to the settings added later. The
  // CACHE is a copy the server already has, so it must go — the next rep on
  // this phone must not inherit it. The PENDING change is the rep's own choice
  // and the only copy of it, so it must survive, exactly as an unsent knock
  // does. This test lives beside the knocks one because it is the same mistake.
  const { sweepDeviceCopies } = await import('@/lib/sign-out-flow');
  const { cachePreferences, markPending, readCachedPreferences, readPendingPreferences } =
    await import('@/lib/preferences-store');
  const { UNREAD } = await import('@/lib/preferences');

  await cachePreferences(REP, { learningMode: true, experienceMode: 'expert' });
  await markPending(REP, { experienceMode: 'standard' });

  await sweepDeviceCopies(REP);

  assert.deepEqual(await readCachedPreferences(REP), UNREAD, 'the cache was not swept');
  assert.deepEqual(
    await readPendingPreferences(REP),
    { experienceMode: 'standard' },
    'the sweep threw away a setting the rep changed that had not been sent',
  );
});

test('the sign-out warning counts the doors still waiting', async () => {
  const { strandedAtSignOut, signOutMessage } = await import('@/lib/sign-out-flow');
  await addKnock(REP, 'sold');
  const stranded = await strandedAtSignOut(REP);
  assert.equal(stranded.knocks, 1);
  // A rep must be told before they confirm, not discover it tomorrow.
  assert.match(signOutMessage(stranded), /door has not reached the server/i);
});
