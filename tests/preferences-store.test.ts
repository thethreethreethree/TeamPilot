/**
 * Regression tests for where the two preferences live on the phone.
 *
 * THE ONE THAT MATTERS is clearing a pending change after a write lands. The
 * obvious implementation is "the write succeeded, so remove the pending file".
 * It loses a toggle:
 *
 *   the rep switches Learning Mode ON, the write goes out, and while it is in
 *   flight they switch it back OFF. The ON write returns 200, the pending file
 *   is wiped, and their OFF — the thing they actually want — is gone. The screen
 *   then refreshes to ON and it looks like the app changed it back by itself.
 *
 * So a write clears only the exact value it SENT, and anything newer stays
 * waiting.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cachePreferences,
  clearCachedPreferences,
  clearPending,
  clearStoredPreferences,
  markPending,
  readCachedPreferences,
  readPendingPreferences,
} from '@/lib/preferences-store';
import { UNREAD } from '@/lib/preferences';

const REP = 'rep-1';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('nothing stored reads as unread, not as a default', async () => {
  assert.deepEqual(await readCachedPreferences(REP), UNREAD);
  assert.equal(await readPendingPreferences(REP), null);
});

test('a cached answer comes back', async () => {
  await cachePreferences(REP, { learningMode: true, experienceMode: 'standard' });
  assert.deepEqual(await readCachedPreferences(REP), {
    learningMode: true,
    experienceMode: 'standard',
  });
});

test('a corrupt cache reads as unread rather than throwing', async () => {
  await AsyncStorage.setItem(`prefs.v1.${REP}`, '{not json');
  assert.deepEqual(await readCachedPreferences(REP), UNREAD);
});

test('a cache holding a nonsense value drops that field only', async () => {
  await AsyncStorage.setItem(
    `prefs.v1.${REP}`,
    JSON.stringify({ learningMode: true, experienceMode: 'wizard' }),
  );
  assert.deepEqual(await readCachedPreferences(REP), {
    learningMode: true,
    experienceMode: null,
  });
});

test('a pending change is remembered', async () => {
  await markPending(REP, { learningMode: true });
  assert.deepEqual(await readPendingPreferences(REP), { learningMode: true });
});

test('a second pending change merges rather than replacing', async () => {
  // Toggling two different settings offline must not lose the first.
  await markPending(REP, { learningMode: true });
  await markPending(REP, { experienceMode: 'standard' });
  assert.deepEqual(await readPendingPreferences(REP), {
    learningMode: true,
    experienceMode: 'standard',
  });
});

test('changing your mind overwrites the earlier pending value', async () => {
  await markPending(REP, { learningMode: true });
  await markPending(REP, { learningMode: false });
  assert.deepEqual(await readPendingPreferences(REP), { learningMode: false });
});

test('a landed write clears ONLY the value it sent', async () => {
  await markPending(REP, { learningMode: true, experienceMode: 'standard' });
  await clearPending(REP, { learningMode: true });
  assert.deepEqual(await readPendingPreferences(REP), { experienceMode: 'standard' });
});

test('a write that lands AFTER the rep changed their mind does not undo them', async () => {
  // The whole reason clearPending takes the sent value.
  await markPending(REP, { learningMode: true });
  await markPending(REP, { learningMode: false }); // they toggled back mid-flight
  await clearPending(REP, { learningMode: true }); // the OLD write returns 200
  assert.deepEqual(
    await readPendingPreferences(REP),
    { learningMode: false },
    'the newer choice was thrown away by the older write',
  );
});

test('clearing the last pending value removes the record entirely', async () => {
  await markPending(REP, { learningMode: true });
  await clearPending(REP, { learningMode: true });
  assert.equal(await readPendingPreferences(REP), null);
});

test('clearing when nothing is pending is harmless', async () => {
  await clearPending(REP, { learningMode: true });
  assert.equal(await readPendingPreferences(REP), null);
});

test('one rep never sees another rep’s settings', async () => {
  await cachePreferences(REP, { learningMode: true, experienceMode: 'standard' });
  await markPending(REP, { learningMode: false });
  assert.deepEqual(await readCachedPreferences('rep-2'), UNREAD);
  assert.equal(await readPendingPreferences('rep-2'), null);
});

test('the sign-out sweep clears the CACHE but NEVER the unsent change', async () => {
  // The knocks near-miss, in a new place. A cached value is a copy the server
  // already has; a pending change is the rep's own choice and the only copy of
  // it. Sweeping it would silently discard what they set.
  await cachePreferences(REP, { learningMode: true, experienceMode: 'expert' });
  await markPending(REP, { experienceMode: 'standard' });
  await clearCachedPreferences(REP);
  assert.deepEqual(await readCachedPreferences(REP), UNREAD, 'the cache survived the sweep');
  assert.deepEqual(
    await readPendingPreferences(REP),
    { experienceMode: 'standard' },
    'the sweep threw away a change the rep made that had not been sent',
  );
});

test('clearing everything explicitly does clear both', async () => {
  await cachePreferences(REP, { learningMode: true, experienceMode: 'expert' });
  await markPending(REP, { experienceMode: 'standard' });
  await clearStoredPreferences(REP);
  assert.deepEqual(await readCachedPreferences(REP), UNREAD);
  assert.equal(await readPendingPreferences(REP), null);
});

test('sign-out leaves the other rep on a shared phone alone', async () => {
  await cachePreferences('rep-2', { learningMode: true, experienceMode: 'expert' });
  await clearStoredPreferences(REP);
  assert.deepEqual(await readCachedPreferences('rep-2'), {
    learningMode: true,
    experienceMode: 'expert',
  });
});
