/**
 * The saved-recordings list under CONCURRENT writes (found 2026-10-01, sweeping the app's stores for the
 * knock queue's race).
 *
 * Every write in recording-store is a read (`getItem`) then a write (`setItem`) with an await between, and
 * nothing serialised them. The background sender calls `updateRecording` when an upload finishes; the
 * recorder calls `addRecording` the instant a new pitch is saved. Interleaved, the update is computed from a
 * list that does not yet contain the new pitch and writes it back without it:
 *
 *   the new recording's entry is gone. Its audio is still on the phone, but the app no longer knows it
 *   exists: it is never sent, never listed, and the sign-out warning does not count it.
 *
 * This store holds the only irreplaceable data in the app. These tests run the operations at the same
 * moment and require that every one of them survives.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addRecording,
  listRecordings,
  removeRecording,
  updateRecording,
} from '@/lib/audio/recording-store';

const REP = 'rep-1';
type NewRecording = Parameters<typeof addRecording>[1];

const rec = (id: string): NewRecording => ({
  clientId: id,
  fileUri: `file:///docs/recordings/${id}.m4a`,
  sizeBytes: 1_000,
  durationMs: 60_000,
  mimeType: 'audio/m4a',
  recordedAt: '2026-10-01T10:00:00.000Z',
  label: null,
});

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('a pitch saved while another finishes uploading is not lost', async () => {
  await addRecording(REP, rec('rec_a'));
  // The sender marks A uploaded at the same moment the rep stops recording B.
  await Promise.all([updateRecording(REP, 'rec_a', { status: 'uploaded' }), addRecording(REP, rec('rec_b'))]);
  const rows = await listRecordings(REP);
  const byId = new Map(rows.map((r) => [r.clientId, r]));
  assert.ok(byId.has('rec_b'), 'the new recording must still be on the list');
  assert.equal(byId.get('rec_a')?.status, 'uploaded', 'and the upload must still be recorded');
});

test('ten saves racing ten updates and ten removals keep exactly the right entries', async () => {
  for (let i = 0; i < 10; i++) await addRecording(REP, rec(`old_${i}`));
  for (let i = 0; i < 10; i++) await addRecording(REP, rec(`keep_${i}`));
  const ops: Promise<unknown>[] = [];
  for (let i = 0; i < 10; i++) {
    ops.push(removeRecording(REP, `old_${i}`));
    ops.push(updateRecording(REP, `keep_${i}`, { attempts: 1 }));
    ops.push(addRecording(REP, rec(`new_${i}`)));
  }
  await Promise.all(ops);
  const rows = await listRecordings(REP);
  const ids = rows.map((r) => r.clientId).sort();
  const want = [...Array.from({ length: 10 }, (_, i) => `keep_${i}`), ...Array.from({ length: 10 }, (_, i) => `new_${i}`)].sort();
  assert.deepEqual(ids, want);
  for (const r of rows.filter((r) => r.clientId.startsWith('keep_'))) {
    assert.equal(r.attempts, 1, `${r.clientId} lost its update`);
  }
});

test('a failed write does not jam the ones after it', async () => {
  const setItem = AsyncStorage.setItem;
  let fail = true;
  (AsyncStorage as unknown as { setItem: typeof setItem }).setItem = async (k: string, v: string) => {
    if (fail) {
      fail = false;
      throw new Error('disk full');
    }
    return setItem(k, v);
  };
  try {
    await assert.rejects(addRecording(REP, rec('rec_fail')));
    await addRecording(REP, rec('rec_next'));
    assert.deepEqual((await listRecordings(REP)).map((r) => r.clientId), ['rec_next']);
  } finally {
    (AsyncStorage as unknown as { setItem: typeof setItem }).setItem = setItem;
  }
});
