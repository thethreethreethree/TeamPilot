/**
 * The grace window on unhandled promise rejections.
 *
 * This is the only judgement in the uncaught-failure path, and like `crash-notable` it can fail in two opposite
 * directions. Drop too much and a release build stays silent about the rejections React Native itself never
 * tracks outside development. Keep too much and a rep's problem report lists failures that never happened —
 * because attaching a `.catch()` a tick after the rejection is ordinary, correct code, and the tracker reports
 * that as unhandled before taking it back.
 *
 * The false-positive tests are the load-bearing ones. A report that cries wolf sends whoever reads it hunting a
 * bug that does not exist, which is worse than the empty log it replaced.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PENDING,
  REJECTION_GRACE_MS,
  WHERE_FATAL,
  WHERE_REJECTION,
  WHERE_UNCAUGHT,
  createRejectionGate,
  type Timers,
} from '@/lib/crash-uncaught';
import { makeEntry } from '@/lib/crash-log';

/**
 * A clock the test drives by hand.
 *
 * Real timers would make every case below cost two seconds and turn a timing rule into a flaky test. Here
 * `tick()` is the only thing that makes time pass, so what the assertions pin is the RULE and not the machine.
 */
function fakeTimers(): Timers & { tick: () => void; live: () => number } {
  let next = 1;
  const due = new Map<number, () => void>();
  return {
    schedule(fn) {
      const id = next++;
      due.set(id, fn);
      return id;
    },
    cancel(handle) {
      due.delete(handle as number);
    },
    tick() {
      const firing = [...due.entries()];
      due.clear();
      firing.forEach(([, fn]) => fn());
    },
    live: () => due.size,
  };
}

// ---------------------------------------------------------------------------
// The false positives — the reason the window exists at all

test('a rejection handled inside the window is never recorded', () => {
  const seen: unknown[] = [];
  const timers = fakeTimers();
  const gate = createRejectionGate((r) => seen.push(r), REJECTION_GRACE_MS, timers);

  gate.unhandled(1, new Error('caught one tick later'));
  gate.handled(1);
  timers.tick();

  assert.deepEqual(seen, [], 'code that attaches its catch a tick later is not a failure');
  assert.equal(gate.pending(), 0);
  assert.equal(timers.live(), 0, 'the timer is cancelled, not merely ignored');
});

test('handling one rejection does not cancel another', () => {
  const seen: unknown[] = [];
  const timers = fakeTimers();
  const gate = createRejectionGate((r) => seen.push(r), REJECTION_GRACE_MS, timers);

  gate.unhandled(1, 'handled');
  gate.unhandled(2, 'never handled');
  gate.handled(1);
  timers.tick();

  assert.deepEqual(seen, ['never handled']);
});

test('handled for an id that was never pending is harmless', () => {
  const timers = fakeTimers();
  const gate = createRejectionGate(() => assert.fail('nothing to record'), REJECTION_GRACE_MS, timers);
  gate.handled(99);
  timers.tick();
  assert.equal(gate.pending(), 0);
});

test('handled after the window closed does not un-record it', () => {
  const seen: unknown[] = [];
  const timers = fakeTimers();
  const gate = createRejectionGate((r) => seen.push(r), REJECTION_GRACE_MS, timers);

  gate.unhandled(1, 'real failure');
  timers.tick();
  gate.handled(1); // too late; the entry is already written

  assert.deepEqual(seen, ['real failure'], 'a late catch cannot erase a report already sent');
});

// ---------------------------------------------------------------------------
// The failures that must survive

test('a rejection nobody handles is recorded once the window closes', () => {
  const seen: unknown[] = [];
  const timers = fakeTimers();
  const gate = createRejectionGate((r) => seen.push(r), REJECTION_GRACE_MS, timers);

  const reason = new Error('upload never awaited');
  gate.unhandled(7, reason);
  assert.deepEqual(seen, [], 'nothing is recorded while the window is still open');
  assert.equal(gate.pending(), 1);

  timers.tick();
  assert.deepEqual(seen, [reason]);
  assert.equal(gate.pending(), 0, 'the entry is released, not held forever');
});

test('the same id reported twice starts one clock and records once', () => {
  const seen: unknown[] = [];
  const timers = fakeTimers();
  const gate = createRejectionGate((r) => seen.push(r), REJECTION_GRACE_MS, timers);

  gate.unhandled(3, 'first');
  gate.unhandled(3, 'second');
  assert.equal(gate.pending(), 1);
  timers.tick();

  assert.deepEqual(seen, ['first'], 'a re-report is the same failure, not a new one');
});

test('a rejection storm is capped rather than holding a timer each', () => {
  const seen: unknown[] = [];
  const timers = fakeTimers();
  const gate = createRejectionGate((r) => seen.push(r), REJECTION_GRACE_MS, timers);

  for (let i = 0; i < MAX_PENDING + 50; i += 1) gate.unhandled(i, `reject ${i}`);
  assert.equal(gate.pending(), MAX_PENDING);

  timers.tick();
  assert.equal(seen.length, MAX_PENDING, 'the storm is described by its first few, not queued in full');
  assert.equal(seen[0], 'reject 0', 'and it is the FIRST ones that are kept — where the cause is');
});

test('a record that throws still releases its slot', () => {
  const timers = fakeTimers();
  const gate = createRejectionGate(() => {
    throw new Error('storage is broken too');
  }, REJECTION_GRACE_MS, timers);

  gate.unhandled(1, 'anything');
  assert.throws(() => timers.tick());
  assert.equal(gate.pending(), 0, 'otherwise the cap fills with ids nothing can clear');
});

// ---------------------------------------------------------------------------
// What a rep actually reads

test('each kind names itself in words a rep can place', () => {
  const wheres = [WHERE_UNCAUGHT, WHERE_FATAL, WHERE_REJECTION];
  assert.equal(new Set(wheres).size, 3, 'three distinct causes must read as three distinct rows');
  wheres.forEach((where) => {
    assert.ok(!/error|exception|promise|reject/i.test(where), `"${where}" is jargon, not a place`);
    const entry = makeEntry(new Error('x'), where, new Date('2026-09-11T10:00:00.000Z'), 'id');
    assert.equal(entry.where, where, 'the scrubber must not eat its own heading');
  });
});

test('a rejected non-Error is described, never serialized into the log', () => {
  // Promises reject with whatever they like — a whole response body included. `makeEntry` must not stringify it.
  const entry = makeEntry({ token: 'secret', transcript: 'the customer said' }, WHERE_REJECTION, new Date(), 'id');
  assert.ok(!entry.message.includes('secret'));
  assert.ok(!entry.message.includes('the customer said'));
  assert.equal(entry.message, 'A object was thrown instead of an error.');
});
