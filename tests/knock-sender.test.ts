/**
 * Regression tests for the sweep that gets a day of doors to the server.
 *
 * WHY THIS IS THE ONE TO TEST HARDEST. A door-to-door rep's entire day is a
 * count, and every door they knock passes through this function. Nothing on
 * screen reports what it does — a knock that quietly stops being retried, or one
 * that gets sent twice, looks exactly like a knock that worked. The failure is
 * silent by construction.
 *
 * THREE RULES ARE LOAD-BEARING AND EACH IS TESTED FOR ITS OWN REASON:
 *
 *   1. A CONFIRMED KNOCK LEAVES THE QUEUE, AND ONLY THAT ONE. Removing the wrong
 *      entry deletes a door nobody sent.
 *
 *   2. A 401-CLASS FAILURE STOPS THE WHOLE SWEEP. Every other knock will hit the
 *      same wall, and pushing on would spend every door's attempt budget against
 *      a backend that is not deployed — after which they would stop being
 *      retried at all, permanently, for a reason no rep could see.
 *
 *   3. A TRANSIENT FAILURE STOPS THE SWEEP TOO, but a REJECTION does not. A dead
 *      connection says nothing about the next knock and everything about the
 *      next second; a refused body says the opposite. Getting these the wrong
 *      way round either burns a day's attempts in a basement, or lets one
 *      malformed knock block every good one behind it.
 *
 * The sender is stubbed at the module boundary, so this exercises the DECISIONS
 * without a network — the same shape as the auto-send and outbox tests.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addKnock, listKnocks, __resetKnockSeq, type Knock } from '@/lib/doors/knock-store';
import { runKnockSend, resetKnockSending, type KnockSender } from '@/lib/doors/knock-sweep';
import type { KnockSend } from '@/lib/doors/door-log-api';

const REP = 'rep-1';

/**
 * A sender that records what it was handed and answers with a fixed verdict.
 *
 * Injected rather than mocked. The sweep takes its sender as a parameter — the
 * same shape the recording sender and the write queue use — so these tests
 * exercise the real decision logic with no module interception and no network.
 */
function stub(verdict: (i: number) => KnockSend) {
  const seen: string[] = [];
  let i = 0;
  const send = async (k: Knock): Promise<KnockSend> => {
    seen.push(k.clientKnockId);
    return verdict(i++);
  };
  return { seen, send };
}

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  __resetKnockSeq();
  resetKnockSending();
});

test('a confirmed knock leaves the queue', async () => {
  const { send, seen } = stub(() => ({ ok: true }));
  await addKnock(REP, 'sold');
  await addKnock(REP, 'no_answer');

  const result = await runKnockSend(REP, { force: true, send });

  assert.equal(result.sent, 2);
  assert.equal(seen.length, 2);
  assert.equal((await listKnocks(REP)).length, 0);
});

test('a 401-class failure stops the WHOLE sweep', async () => {
  // Every other knock hits the same wall. Pushing on would spend every door's
  // attempts against an undeployed backend, after which they would stop being
  // retried permanently — for a reason no rep could ever see.
  const { send, seen } = stub(() => ({ ok: false, reason: 'needs-shim', why: null }));
  for (let i = 0; i < 5; i++) await addKnock(REP, 'no_answer');

  await runKnockSend(REP, { force: true, send });

  assert.equal(seen.length, 1, 'kept going past the wall');
  assert.equal((await listKnocks(REP)).length, 5, 'a door was dropped');
});

test('once stopped, it stays stopped until reset', async () => {
  const { send, seen } = stub(() => ({ ok: false, reason: 'needs-shim', why: null }));
  await addKnock(REP, 'sold');
  await runKnockSend(REP, { force: true, send });
  await runKnockSend(REP, { force: true, send });
  // `force` skips the cooldown; it must never override the hard stop.
  assert.equal(seen.length, 1);
});

test('a transient failure stops the sweep and keeps every knock', async () => {
  const { send, seen } = stub(() => ({ ok: false, reason: 'transient' }));
  await addKnock(REP, 'sold');
  await addKnock(REP, 'go_back');

  await runKnockSend(REP, { force: true, send });

  // The connection is bad right now — that says nothing about the next knock
  // and everything about the next second.
  assert.equal(seen.length, 1);
  const rows = await listKnocks(REP);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].attempts, 1);
  assert.equal(rows[1].attempts, 0, 'an untried knock was charged an attempt');
});

test('a REJECTED knock does not block the ones behind it', async () => {
  // The opposite of transient: the server understood this body and refused it.
  // Stopping here would let one malformed knock hold up a whole street.
  const { send, seen } = stub((i) =>
    i === 0 ? { ok: false, reason: 'rejected', message: 'bad outcome' } : { ok: true },
  );
  await addKnock(REP, 'sold');
  await addKnock(REP, 'no_answer');

  const result = await runKnockSend(REP, { force: true, send });

  assert.equal(seen.length, 2, 'a good knock was blocked by a bad one');
  assert.equal(result.sent, 1);
  const left = await listKnocks(REP);
  assert.equal(left.length, 1, 'the rejected knock was thrown away');
  assert.equal(left[0].lastError, 'bad outcome');
});

test('the cooldown holds a second sweep back', async () => {
  const { send, seen } = stub(() => ({ ok: true }));
  await addKnock(REP, 'sold');
  await runKnockSend(REP, { send, now: 1_000_000 });
  await addKnock(REP, 'go_back');

  await runKnockSend(REP, { send, now: 1_001_000 });
  assert.equal(seen.length, 1, 'swept inside the cooldown');

  await runKnockSend(REP, { send, now: 1_100_000 });
  assert.equal(seen.length, 2);
});

test('nothing to send is not an error', async () => {
  const { send, seen } = stub(() => ({ ok: true }));
  const result = await runKnockSend(REP, { force: true, send });
  assert.equal(result.sent, 0);
  assert.equal(seen.length, 0);
});

// ------------------------------------------------------- concurrency

test('a second sweep while one is running does NOTHING', async () => {
  // Two concurrent sweeps would send the same knocks twice, and a knock is a
  // door a rep actually stood at — double-counting inflates the one figure
  // their day is measured by. Removing this guard broke no test until now.
  await addKnock(REP, 'sold');
  await addKnock(REP, 'no_answer');

  let inFlight = 0;
  let maxInFlight = 0;
  let second: { sent: number; skipped: boolean } | null = null;

  const send: KnockSender = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    second = await runKnockSend(REP, { force: true, send });
    inFlight -= 1;
    return { ok: true };
  };

  const first = await runKnockSend(REP, { force: true, send });

  assert.equal(maxInFlight, 1, 'two sweeps sent at once');
  assert.equal(second !== null && (second as { skipped: boolean }).skipped, true);
  assert.equal(second !== null && (second as { sent: number }).sent, 0);
  assert.equal(first.sent, 2, 'the real sweep did not finish');
  assert.equal((await listKnocks(REP)).length, 0);
});

test('the sweep lock is released afterwards, and after a throw', async () => {
  // A lock never released stops a rep's doors reaching the server for the whole
  // session — worse than no lock at all.
  await addKnock(REP, 'sold');
  const boom: KnockSender = async () => {
    throw new Error('network died mid-send');
  };
  await runKnockSend(REP, { force: true, send: boom }).catch(() => undefined);

  const { send } = stub(() => ({ ok: true }));
  const result = await runKnockSend(REP, { force: true, send });
  assert.equal(result.skipped, false, 'a thrown send left the sweep locked');
});
