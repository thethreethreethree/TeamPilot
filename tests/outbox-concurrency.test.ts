/**
 * The outbox under CONCURRENT writes (found 2026-10-01, sweeping the app's stores for the knock queue's race).
 *
 * `enqueue`, `removeEntry`, and the bookkeeping inside `runOutbox` are each a read then a write with an await
 * between, and nothing serialised them. `runOutbox` already re-reads after each send, so a correction made
 * DURING the request wins over its stale snapshot; but the re-read and the write that follows it were still
 * open to an `enqueue` landing between them. When that happens one write erases the other: a rep's newer
 * outcome or rename silently disappears from the queue, or a sent entry comes back and is sent again.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueue, listOutbox, removeEntry, runOutbox, __resetOutbox, type OutboxSender } from '@/lib/sync/outbox';

const REP = 'rep-1';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  __resetOutbox();
});

test('ten queued corrections racing ten removals keep exactly the ten new entries', async () => {
  const old = [];
  for (let i = 0; i < 10; i++) old.push(await enqueue(REP, { sessionId: `old_${i}`, kind: 'outcome', outcome: 'sold' }));
  const ops: Promise<unknown>[] = [];
  for (let i = 0; i < 10; i++) {
    ops.push(removeEntry(REP, old[i]!.id));
    ops.push(enqueue(REP, { sessionId: `new_${i}`, kind: 'rename', clientLabel: `Client ${i}` }));
  }
  await Promise.all(ops);
  const got = (await listOutbox(REP)).map((e) => e.sessionId).sort();
  assert.deepEqual(got, Array.from({ length: 10 }, (_, i) => `new_${i}`).sort());
});

test('a correction queued while a send is being recorded is not erased', async () => {
  for (let i = 0; i < 5; i++) await enqueue(REP, { sessionId: `s${i}`, kind: 'outcome', outcome: 'no_sale' });
  // Each send resolves at once, so the sweep's re-read and write run back to back with the rep's taps.
  const sent = new Set<string>();
  const send: OutboxSender = async (e) => {
    sent.add(e.sessionId);
    return { ok: true };
  };
  const taps: Promise<unknown>[] = [];
  for (let i = 0; i < 5; i++) taps.push(enqueue(REP, { sessionId: `late_${i}`, kind: 'rename', clientLabel: `Late ${i}` }));
  await Promise.all([runOutbox(REP, { force: true, send }), ...taps]);
  const left = (await listOutbox(REP)).map((e) => e.sessionId);
  for (let i = 0; i < 5; i++) {
    // Queued before the sweep read the list, it is sent in this sweep; after, it waits. Never neither.
    assert.ok(left.includes(`late_${i}`) || sent.has(`late_${i}`), `late_${i} was neither sent nor still waiting`);
  }
});
