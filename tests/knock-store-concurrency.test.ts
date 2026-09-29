/**
 * The knock queue under CONCURRENT writes (found 2026-09-29, while building the quiet undo).
 *
 * Every mutation in knock-store is a read (`getItem`) then a write (`setItem`), with an await between them
 * and nothing serialising them. The Door Log calls `flush()` straight after every tap, so the send sweep's
 * `removeKnock` routinely runs WHILE the rep taps the next door (`addKnock`). If the two interleave, the
 * second write is computed from a stale read and overwrites the first:
 *
 *   - the new tap is lost — a door the rep knocked, erased from the phone before it was ever sent; or
 *   - the sent knock comes back — and is sent again (harmless: the server dedupes on clientKnockId).
 *
 * The first is silent data loss. These tests run the operations at the same moment and require that every
 * one of them survives.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addKnock, listKnocks, removeKnock, __resetKnockSeq } from '@/lib/doors/knock-store';

const REP = 'rep-1';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  __resetKnockSeq();
});

test('a tap during a send is not lost', async () => {
  const sent = await addKnock(REP, 'no_answer');
  // The sweep confirms `sent` and removes it at the same moment the rep taps the next door.
  const [, tapped] = await Promise.all([removeKnock(REP, sent.clientKnockId), addKnock(REP, 'sold')]);
  const left = (await listKnocks(REP)).map((k) => k.clientKnockId);
  assert.deepEqual(left, [tapped.clientKnockId], 'the new tap must be queued, and the sent one gone');
});

test('ten taps racing ten removals keep exactly the ten new taps', async () => {
  const old = [];
  for (let i = 0; i < 10; i++) old.push(await addKnock(REP, 'no_answer'));
  const ops: Promise<unknown>[] = [];
  const fresh: Promise<{ clientKnockId: string }>[] = [];
  for (let i = 0; i < 10; i++) {
    ops.push(removeKnock(REP, old[i]!.clientKnockId));
    const f = addKnock(REP, 'go_back');
    fresh.push(f);
    ops.push(f);
  }
  await Promise.all(ops);
  const want = (await Promise.all(fresh)).map((k) => k.clientKnockId).sort();
  const got = (await listKnocks(REP)).map((k) => k.clientKnockId).sort();
  assert.deepEqual(got, want);
});
