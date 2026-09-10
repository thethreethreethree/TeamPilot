/**
 * Regression tests for the offline write queue.
 *
 * WHAT GOES WRONG HERE IS NEVER A CRASH. It is a rep who marked a call Sold in a
 * stairwell, watched the app say it was saved, and found nothing there a week
 * later — or worse, found "No sale", because two instructions were queued and the
 * older one was sent second. So the tests that matter are about which
 * instruction survives, what happens to one the server refuses, and the fact
 * that nothing is ever dropped quietly.
 *
 * The sender is injected, not mocked. This file is about the DECISION to send
 * and what to do with the verdict; the mapping from an HTTP status to that
 * verdict is `classify`, tested separately below, and neither test needs a
 * network.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type OutboxRunResult,
  enqueue,
  listOutbox,
  pendingFor,
  removeEntry,
  clearOutbox,
  runOutbox,
  outboxStopped,
  clearOutboxStop,
  stalled,
  expired,
  __resetOutbox,
  MAX_OUTBOX_ATTEMPTS,
  type OutboxEntry,
  type OutboxSender,
  type SendOutcome,
} from '@/lib/sync/outbox';
import { classify } from '@/lib/sync/outbox-classify';

const REP = 'rep-1';

beforeEach(async () => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  __resetOutbox();
});

/** A sender that records what it was handed and answers with a fixed verdict. */
function stubSend(verdict: (e: OutboxEntry) => SendOutcome) {
  const seen: OutboxEntry[] = [];
  const send: OutboxSender = async (e) => {
    seen.push(e);
    return verdict(e);
  };
  return { send, seen };
}

const ok = (): SendOutcome => ({ ok: true });

// --------------------------------------------------------------- queueing

test('a queued write survives being read back', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold', dealValue: 4500 });

  const [entry] = await listOutbox(REP);
  assert.equal(entry.sessionId, 's1');
  assert.equal(entry.outcome, 'sold');
  assert.equal(entry.dealValue, 4500);
  assert.equal(entry.attempts, 0);
});

test('a second instruction for the same call REPLACES the first', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'no_sale' });
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold', dealValue: 4500 });

  const queue = await listOutbox(REP);
  // The rep changed their mind. Sending both would publish "No sale" first, and a
  // manager's team screen would show it until the second landed.
  assert.equal(queue.length, 1);
  assert.equal(queue[0].outcome, 'sold');
});

test('a rename and an outcome for the same call are separate instructions', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await enqueue(REP, { sessionId: 's1', kind: 'rename', clientLabel: 'Rowan & Co' });

  assert.equal((await listOutbox(REP)).length, 2);
});

test('a replacement keeps its place in the queue', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'no_sale' });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'sold' });
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });

  const queue = await listOutbox(REP);
  // Otherwise a rep who keeps adjusting one call pushes it behind everything
  // else forever — the write they are actively thinking about lands last.
  assert.deepEqual(
    queue.map((e) => e.sessionId),
    ['s1', 's2'],
  );
});

test('a replacement resets the attempt count', async () => {
  const { send } = stubSend(() => ({ ok: false, reason: 'transient' }));
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'no_sale' });
  await runOutbox(REP, { force: true, send });
  assert.equal((await listOutbox(REP))[0].attempts, 1);

  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  // New intent, not a retry of the old one. Inheriting the failures would mean a
  // correction arrives already partway through its budget.
  assert.equal((await listOutbox(REP))[0].attempts, 0);
});

test('one rep never sees another rep queue', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  assert.equal((await listOutbox('rep-2')).length, 0);
});

test('sign-out clears the queue', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await clearOutbox(REP);
  assert.equal((await listOutbox(REP)).length, 0);
});

test('pendingFor answers for one call only', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'no_sale' });

  const forOne = await pendingFor(REP, 's1');
  assert.equal(forOne.length, 1);
  assert.equal(forOne[0].sessionId, 's1');
});

// ---------------------------------------------------------------- sending

test('a sent write leaves the queue', async () => {
  const { send, seen } = stubSend(ok);
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });

  const result = await runOutbox(REP, { force: true, send });
  assert.equal(result.sent, 1);
  assert.equal(seen.length, 1);
  assert.equal((await listOutbox(REP)).length, 0);
});

test('writes are sent oldest first', async () => {
  const { send, seen } = stubSend(ok);
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'no_sale' });

  await runOutbox(REP, { force: true, send });
  assert.deepEqual(
    seen.map((e) => e.sessionId),
    ['s1', 's2'],
  );
});

test('a refused write is KEPT, with the reason', async () => {
  const { send } = stubSend(() => ({
    ok: false,
    reason: 'rejected',
    message: 'Deal value must be at most 100000000.',
  }));
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold', dealValue: 1e12 });

  const result = await runOutbox(REP, { force: true, send });
  const [entry] = await listOutbox(REP);
  // "Surface conflicts, never silently drop" — a write that disappeared would be
  // worse than one that never left, because the rep would believe it landed.
  assert.equal(result.blocked, 1);
  assert.equal(entry.blocked, 'rejected');
  assert.equal(entry.lastError, 'Deal value must be at most 100000000.');
});

test('a rejection stops THAT entry, not the sweep', async () => {
  const { send, seen } = stubSend((e) =>
    e.sessionId === 's1' ? { ok: false, reason: 'rejected' } : { ok: true },
  );
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold', dealValue: 1e12 });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'sold' });

  await runOutbox(REP, { force: true, send });
  // One bad value must not hold up every other call's outcome behind it.
  assert.equal(seen.length, 2);
  assert.equal((await listOutbox(REP)).length, 1);
});

test('a transient failure STOPS the sweep', async () => {
  const { send, seen } = stubSend(() => ({ ok: false, reason: 'transient' }));
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'sold' });

  await runOutbox(REP, { force: true, send });
  // The connection is bad right now. Pushing on spends every entry's attempts on
  // writes that would have worked in a minute.
  assert.equal(seen.length, 1);
  assert.deepEqual(
    (await listOutbox(REP)).map((e) => e.attempts),
    [1, 0],
  );
});

test('a 401-class failure stops everything until restart', async () => {
  const { send, seen } = stubSend(() => ({ ok: false, reason: 'needs-shim' }));
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'sold' });

  await runOutbox(REP, { force: true, send });
  assert.equal(seen.length, 1, 'every other entry hits the same wall');
  assert.equal(outboxStopped(), true);

  const again = await runOutbox(REP, { force: true, send });
  assert.equal(again.reason, 'stopped');
  assert.equal(seen.length, 1, 'force skips the cooldown, never the hard stop');

  clearOutboxStop();
  await runOutbox(REP, { force: true, send });
  assert.equal(seen.length, 2, 'a manual send that works lets it resume');
});

test('the cooldown holds a second sweep back', async () => {
  const { send, seen } = stubSend(ok);
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await runOutbox(REP, { send, now: 1_000_000 });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'sold' });

  const second = await runOutbox(REP, { send, now: 1_005_000 });
  assert.equal(second.reason, 'cooldown');
  assert.equal(seen.length, 1);

  await runOutbox(REP, { send, now: 1_040_000 });
  assert.equal(seen.length, 2);
});

test('an entry stops being retried after the attempt cap', async () => {
  const { send } = stubSend(() => ({ ok: false, reason: 'transient' }));
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });

  for (let i = 0; i < MAX_OUTBOX_ATTEMPTS + 2; i++) {
    await runOutbox(REP, { force: true, send });
  }

  const [entry] = await listOutbox(REP);
  assert.equal(entry.attempts, MAX_OUTBOX_ATTEMPTS);
  assert.equal(entry.blocked, 'attempts');
  assert.equal(stalled(entry), true);
  // Giving up is not the same as throwing away.
  assert.equal((await listOutbox(REP)).length, 1);
});

test('an instruction changed mid-flight is not deleted by the older one landing', async () => {
  // The rep taps No sale, the request goes out, and while it is in the air they
  // change it to Sold. The server confirms "no sale" — but that is no longer what
  // they want, and removing the entry here would discard the correction with no
  // trace of it ever having existed.
  const send: OutboxSender = async () => {
    await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold', dealValue: 4500 });
    return { ok: true };
  };
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'no_sale' });

  await runOutbox(REP, { force: true, send });

  const queue = await listOutbox(REP);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].outcome, 'sold');
  assert.equal(queue[0].attempts, 0, 'the correction has not been attempted yet');
});

test('a month-old write is dropped, and the caller is told which', async () => {
  const now = Date.UTC(2026, 9, 1);
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  // Backdate it past the keep-window by rewriting the stored row directly; the
  // queue has no way to enqueue in the past, which is correct.
  const stored: OutboxEntry[] = JSON.parse((await AsyncStorage.getItem(`outbox.v1.${REP}`))!);
  stored[0].queuedAt = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
  await AsyncStorage.setItem(`outbox.v1.${REP}`, JSON.stringify(stored));

  const { send } = stubSend(ok);
  const result = await runOutbox(REP, { force: true, send, now });

  assert.equal(result.dropped.length, 1);
  assert.equal(result.dropped[0].sessionId, 's1');
  assert.equal((await listOutbox(REP)).length, 0);
});

test('expired leaves a fresh write alone', async () => {
  const now = Date.UTC(2026, 9, 1);
  const fresh: OutboxEntry = {
    id: 'x',
    sessionId: 's1',
    kind: 'outcome',
    queuedAt: new Date(now - 60_000).toISOString(),
    attempts: 0,
  };
  assert.equal(expired([fresh], now).length, 0);
});

test('removeEntry takes exactly one', async () => {
  await enqueue(REP, { sessionId: 's1', kind: 'outcome', outcome: 'sold' });
  await enqueue(REP, { sessionId: 's2', kind: 'outcome', outcome: 'sold' });
  const [first] = await listOutbox(REP);

  await removeEntry(REP, first.id);
  const left = await listOutbox(REP);
  assert.equal(left.length, 1);
  assert.equal(left[0].sessionId, 's2');
});

// ------------------------------------------------------------- classify

test('classify maps every status the app can actually receive', () => {
  // The two that can mean "nothing the app sends will be taken": a token the
  // route refuses even after a refresh, or a profile with no company context.
  // Both stop the sweep, because retrying cannot change either.
  for (const status of [401, 403]) {
    assert.equal(classify(status).ok, false);
    assert.equal((classify(status) as { reason: string }).reason, 'needs-shim', `status ${status}`);
  }
  assert.equal((classify(409) as { reason: string }).reason, 'conflict');
  assert.equal((classify(400) as { reason: string }).reason, 'rejected');
  assert.equal((classify(422) as { reason: string }).reason, 'rejected');
  assert.equal((classify(429) as { reason: string }).reason, 'transient');
  assert.equal((classify(500) as { reason: string }).reason, 'transient');
  assert.equal((classify(503) as { reason: string }).reason, 'transient');
  // No status at all: the request never reached a verdict. This is the ordinary
  // offline case and the one that must always earn another try.
  assert.equal((classify(undefined) as { reason: string }).reason, 'transient');
});

test('classify carries the server own words through', () => {
  const out = classify(400, 'Deal value must be at most 100000000.');
  assert.equal((out as { message?: string }).message, 'Deal value must be at most 100000000.');
});

// ------------------------------------------------------- concurrency

test('a second run while one is in flight does NOTHING, and says so', async () => {
  // The guard other code RELIES on. The session screen's retry button has no
  // lock of its own precisely because this exists — a rep double-tapping it
  // must not start two sends of the same queue. Removing the guard broke no
  // test until this one, which is how a load-bearing line gets deleted.
  await enqueue(REP, { kind: 'outcome', sessionId: 'S1', outcome: 'sold' });

  let inFlight = 0;
  let maxInFlight = 0;
  let second: OutboxRunResult | null = null;

  const send: OutboxSender = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    // Start a second run while this one is still going.
    second = await runOutbox(REP, { force: true, send });
    inFlight -= 1;
    return { ok: true };
  };

  const first = await runOutbox(REP, { force: true, send });

  assert.equal(maxInFlight, 1, 'two sends ran at once');
  assert.equal(second !== null && (second as OutboxRunResult).reason, 'already-running');
  assert.equal(second !== null && (second as OutboxRunResult).skipped, true);
  assert.equal(first.sent, 1, 'the real run did not finish its work');
});

test('the guard is released when a run finishes, so the next one works', async () => {
  // A lock that is never released is worse than no lock: the queue would stop
  // sending for the rest of the session.
  await enqueue(REP, { kind: 'outcome', sessionId: 'S1', outcome: 'sold' });
  const a = stubSend(ok);
  await runOutbox(REP, { force: true, send: a.send });

  await enqueue(REP, { kind: 'outcome', sessionId: 'S2', outcome: 'follow_up' });
  const b = stubSend(ok);
  const result = await runOutbox(REP, { force: true, send: b.send });

  assert.notEqual(result.reason, 'already-running', 'the lock was never released');
  assert.equal(result.sent, 1);
});

test('the guard is released even when a send THROWS', async () => {
  // Without a try/finally a thrown sender would wedge the queue permanently.
  await enqueue(REP, { kind: 'outcome', sessionId: 'S1', outcome: 'sold' });
  const boom: OutboxSender = async () => {
    throw new Error('network died mid-send');
  };
  await runOutbox(REP, { force: true, send: boom }).catch(() => undefined);

  const after = stubSend(ok);
  const result = await runOutbox(REP, { force: true, send: after.send });
  assert.notEqual(result.reason, 'already-running', 'a thrown send left the queue locked');
});

test('a 404 is permanent for ITS OWN entry and stops nothing else', () => {
  /**
   * CHANGED 4 September, and the old behaviour was actively harmful.
   *
   * A 404 used to be classified `needs-shim`, which HALTS THE ENTIRE SWEEP until
   * the app restarts. That was right while every coach route was cookie-only: a
   * 404 then meant an RLS-scoped read seeing nothing because the app was not
   * authenticated at all, so the next entry would hit the same wall.
   *
   * The routes take a Bearer token now. A 404 means THAT session or pitch is not
   * there — deleted on the website, or someone else's — and says nothing about
   * the next entry. Under the old rule a single stale entry pointing at a deleted
   * call stranded every other queued write a rep had made, and told them the
   * server would not accept the app.
   */
  assert.equal((classify(404) as { reason: string }).reason, 'rejected');
  assert.notEqual(
    (classify(404) as { reason: string }).reason,
    'needs-shim',
    'a 404 halts the whole outbox again',
  );
});
