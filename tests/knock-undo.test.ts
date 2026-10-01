/**
 * The quiet undo, on the phone (founder 2026-09-29: "a quiet 'undo' for a few seconds").
 *
 * The app sends each knock within a second of the tap, so when a rep presses Undo the knock may be still
 * queued, already on the server, or IN FLIGHT. Deleting it from the queue is wrong for the last two: the
 * phone would forget a door the server is counting. So a queued knock is MARKED undone and the sweep decides.
 * These pin each case — including the one where Undo lands mid-send.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addKnock, listKnocks, markKnockUndone, removeKnockUnlessUndone, countByOutcome, __resetKnockSeq,
} from '@/lib/doors/knock-store';
import { runKnockSend, resetKnockSending } from '@/lib/doors/knock-sweep';
import type { KnockSend, UndoSend } from '@/lib/doors/door-log-api';

const REP = 'rep-1';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  __resetKnockSeq();
  resetKnockSending();
});

const recorder = (answer: (id: string) => UndoSend = () => ({ ok: true })) => {
  const undone: string[] = [];
  return { undone, undo: async (id: string) => (undone.push(id), answer(id)) };
};

test('an undone knock that never left the phone is dropped — nothing is sent at all', async () => {
  const k = await addKnock(REP, 'sold');
  assert.equal(await markKnockUndone(REP, k.clientKnockId), 'queued');
  const sentIds: string[] = [];
  const u = recorder();
  await runKnockSend(REP, { force: true, send: async (x) => (sentIds.push(x.clientKnockId), { ok: true }), undo: u.undo });
  assert.deepEqual(sentIds, [], 'a door the rep took back must not reach the server');
  assert.deepEqual(u.undone, [], 'and there is nothing on the server to undo');
  assert.equal((await listKnocks(REP)).length, 0);
});

test('an undone knock that MAY be on the server (an earlier attempt) gets a server undo, then leaves', async () => {
  const k = await addKnock(REP, 'sold');
  // A first attempt whose answer was lost.
  await runKnockSend(REP, { force: true, send: async (): Promise<KnockSend> => ({ ok: false, reason: 'transient' }) });
  await markKnockUndone(REP, k.clientKnockId);
  resetKnockSending();
  const u = recorder();
  await runKnockSend(REP, { force: true, send: async () => ({ ok: true }), undo: u.undo });
  assert.deepEqual(u.undone, [k.clientKnockId]);
  assert.equal((await listKnocks(REP)).length, 0);
});

test('Undo pressed WHILE the knock is in flight: the undo follows it to the server', async () => {
  const k = await addKnock(REP, 'sold');
  const u = recorder();
  await runKnockSend(REP, {
    force: true,
    // The rep presses Undo during the send, before the sweep hears back.
    send: async (x) => {
      assert.equal(await markKnockUndone(REP, x.clientKnockId), 'queued');
      return { ok: true };
    },
    undo: u.undo,
  });
  assert.deepEqual(u.undone, [k.clientKnockId], 'the server has the knock, so it must be told to undo it');
  assert.equal((await listKnocks(REP)).length, 0);
});

test('a transient undo failure keeps the door queued — still marked undone, still uncounted', async () => {
  const k = await addKnock(REP, 'sold');
  await runKnockSend(REP, { force: true, send: async (): Promise<KnockSend> => ({ ok: false, reason: 'transient' }) });
  await markKnockUndone(REP, k.clientKnockId);
  resetKnockSending();
  const u = recorder(() => ({ ok: false, reason: 'transient' }));
  await runKnockSend(REP, { force: true, send: async () => ({ ok: true }), undo: u.undo });
  const left = await listKnocks(REP);
  assert.equal(left.length, 1);
  assert.equal(left[0]!.undone, true);
  assert.equal(countByOutcome(left, left[0]!.localDate).sold, 0, 'the screen must not count it meanwhile');
});

test('"too late" ends it: the door is on the record, and the phone stops trying', async () => {
  const k = await addKnock(REP, 'sold');
  await runKnockSend(REP, { force: true, send: async (): Promise<KnockSend> => ({ ok: false, reason: 'transient' }) });
  await markKnockUndone(REP, k.clientKnockId);
  resetKnockSending();
  await runKnockSend(REP, { force: true, send: async () => ({ ok: true }), undo: recorder(() => ({ ok: false, reason: 'too-late' })).undo });
  assert.equal((await listKnocks(REP)).length, 0);
});

test('an undone knock does not count on screen', async () => {
  const a = await addKnock(REP, 'sold');
  await addKnock(REP, 'sold');
  await markKnockUndone(REP, a.clientKnockId);
  const rows = await listKnocks(REP);
  assert.equal(countByOutcome(rows, rows[0]!.localDate).sold, 1);
});

test('a knock already confirmed and gone is "absent" — the screen must ask the server instead', async () => {
  assert.equal(await markKnockUndone(REP, 'never-queued'), 'absent');
});

test('mark and confirmed-removal never both "win": one always sees the other', async () => {
  for (let i = 0; i < 20; i++) {
    (AsyncStorage as unknown as { __reset(): void }).__reset();
    const k = await addKnock(REP, 'sold');
    const [removed, marked] = await Promise.all([
      removeKnockUnlessUndone(REP, k.clientKnockId),
      markKnockUndone(REP, k.clientKnockId),
    ]);
    // Either the removal came first (then the mark finds nothing), or the mark did (then it is kept).
    assert.ok(
      (removed === 'removed' && marked === 'absent') || (removed === 'undone' && marked === 'queued'),
      `lost undo: removed=${removed} marked=${marked}`
    );
  }
});

test('an undo the server cannot do YET never blocks the doors behind it', async () => {
  // Order of rollout: if the app reaches phones before the server supports undo (or before 0267 is applied),
  // the undo answers "not yet". That must hold back only ITS door — never every door queued after it.
  const k = await addKnock(REP, 'sold');
  await runKnockSend(REP, { force: true, send: async (): Promise<KnockSend> => ({ ok: false, reason: 'transient' }) });
  await markKnockUndone(REP, k.clientKnockId);
  const later = await addKnock(REP, 'no_answer');
  resetKnockSending();
  const sentIds: string[] = [];
  await runKnockSend(REP, {
    force: true,
    send: async (x) => (sentIds.push(x.clientKnockId), { ok: true }),
    undo: recorder(() => ({ ok: false, reason: 'not-yet' })).undo,
  });
  assert.deepEqual(sentIds, [later.clientKnockId], 'the next door must still be sent');
  const left = await listKnocks(REP);
  assert.deepEqual(left.map((x) => x.clientKnockId), [k.clientKnockId], 'the undone one waits, still marked');
  assert.equal(left[0]!.undone, true);
});
