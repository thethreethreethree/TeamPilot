/**
 * Pending preference changes under CONCURRENT writes (2026-10-08, the sweep the knock-store fix named).
 *
 * markPending and clearPending are each a read then a write with an await between. If a send of one setting
 * completes (clearPending) while the rep changes ANOTHER setting offline (markPending), the clear can write back
 * a pending set computed from the read before the new change, and the new change is gone: it never syncs, and the
 * rep's choice silently reverts on the next load from the server.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPending, markPending, readPendingPreferences } from '@/lib/preferences-store';

const REP = 'rep-1';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('a setting changed while another one is being confirmed is kept', async () => {
  await markPending(REP, { learningMode: true });
  // The learning-mode send lands at the same moment the rep turns on another setting.
  await Promise.all([clearPending(REP, { learningMode: true }), markPending(REP, { experienceMode: 'expert' })]);
  assert.deepEqual(await readPendingPreferences(REP), { experienceMode: 'expert' });
});

test('ten changes racing ten confirmations keep every unconfirmed change', async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.all([
      markPending(REP, { learningMode: i % 2 === 0 }),
      clearPending(REP, { learningMode: i % 2 === 1 }),
      markPending(REP, { experienceMode: 'expert' }),
    ]);
  }
  const held = await readPendingPreferences(REP);
  assert.equal(held?.experienceMode, 'expert', 'an unconfirmed change was dropped');
});
