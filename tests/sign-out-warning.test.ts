/**
 * The sentence a rep reads before signing out.
 *
 * WHY THIS EXISTS. `signOutMessage` speaks about a count only when it is above
 * zero, and the four counts behind it used to fall back to 0 when their store
 * could not be read. A single failed read therefore did not degrade the warning,
 * it DELETED it: a rep holding eight unsent recordings saw the generic line and
 * nothing else, and signed out believing nothing was waiting.
 *
 * Nothing is lost when that happens — these stores survive sign-out by design.
 * What is lost is the one thing the module exists to say, which its own header
 * calls the point: the work is still here, and nobody else can send it for them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signOutMessage } from '@/lib/sign-out-flow';

const none = { recordings: 0, writes: 0, knocks: 0, drafts: 0 };

test('a rep with nothing waiting is not warned about anything', () => {
  const msg = signOutMessage(none);
  assert.ok(!/not been sent|not reached|not been posted/i.test(msg), msg);
  assert.ok(!/could not be checked/i.test(msg), msg);
});

test('an UNKNOWN count is said out loud, not treated as nothing', () => {
  // This is the defect. Before the fix a null read became 0 and the whole
  // warning vanished, which is the one message here that must never be wrong.
  const msg = signOutMessage({ ...none, recordings: null });
  assert.match(msg, /could not be checked/i);
  assert.match(msg, /only you can send it/i);
});

test('every one of the four stores gets the same treatment when it fails', () => {
  // A sweep that covered three of four would leave exactly one silent hole, and
  // nothing about the screen would show which.
  for (const key of ['recordings', 'writes', 'knocks', 'drafts'] as const) {
    const msg = signOutMessage({ ...none, [key]: null });
    assert.match(msg, /could not be checked/i, `${key} failing did not warn`);
  }
});

test('the unknown line is said ONCE even when everything fails', () => {
  const msg = signOutMessage({ recordings: null, writes: null, knocks: null, drafts: null });
  assert.equal((msg.match(/could not be checked/gi) ?? []).length, 1, msg);
});

test('a real count still reads exactly as it did, singular and plural', () => {
  assert.match(signOutMessage({ ...none, recordings: 1 }), /1 recording has not been sent yet/);
  assert.match(signOutMessage({ ...none, recordings: 3 }), /3 recordings have not been sent yet/);
  assert.match(signOutMessage({ ...none, knocks: 1 }), /1 door has not reached the server/);
  assert.match(signOutMessage({ ...none, writes: 2 }), /2 changes have not reached the server/);
  assert.match(signOutMessage({ ...none, drafts: 1 }), /1 message you typed has not been posted/);
});

test('a known count and an unknown one are both reported', () => {
  // The rep has 2 recordings AND we could not check the doors. Both matter, and
  // reporting only the one we are sure of is how the other gets forgotten.
  const msg = signOutMessage({ ...none, recordings: 2, knocks: null });
  assert.match(msg, /2 recordings have not been sent yet/);
  assert.match(msg, /could not be checked/i);
});

test('the warning never reads as a fault of the rep or of the app', () => {
  const msg = signOutMessage({ recordings: null, writes: 1, knocks: 2, drafts: 1 });
  assert.ok(!/error|failed|sorry|problem/i.test(msg), msg);
});

/**
 * The other half: the counts themselves.
 *
 * Proven necessary by mutation. Putting `.catch(() => 0)` back in
 * `strandedAtSignOut` failed NONE of the tests above, because they only exercise
 * the sentence. The fallback that produces the null was unguarded, so the
 * silence could have come straight back with a green suite.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { strandedAtSignOut } from '@/lib/sign-out-flow';

test('a store that throws yields NULL, not a confident zero', async () => {
  // BOTH readers are replaced. The drafts counter reads getAllKeys rather than
  // getItem, and replacing only one of them tested three fields while quietly
  // letting the fourth answer 0 - which is the same silence this whole file is
  // about, one level down.
  const store = AsyncStorage as unknown as {
    getItem: (k: string) => Promise<string | null>;
    getAllKeys: () => Promise<readonly string[]>;
  };
  const realGet = store.getItem.bind(store);
  const realKeys = store.getAllKeys.bind(store);
  const unavailable = async (): Promise<never> => {
    throw new Error('storage is unavailable');
  };
  store.getItem = unavailable;
  store.getAllKeys = unavailable;
  try {
    const stranded = await strandedAtSignOut('rep-1');
    // Every field that depends on a read must be unknown, never 0.
    for (const [key, value] of Object.entries(stranded)) {
      assert.equal(value, null, `${key} came back as ${String(value)} rather than null`);
    }
    // And the sentence must then carry the warning.
    assert.match(signOutMessage(stranded), /could not be checked/i);
  } finally {
    // Nothing was written, so restoring the two readers is the whole cleanup.
    store.getItem = realGet;
    store.getAllKeys = realKeys;
  }
});

test('a signed-out caller gets real zeros, because nothing of theirs IS waiting', async () => {
  // The one case where 0 is the truth rather than a fallback.
  const stranded = await strandedAtSignOut(null);
  assert.deepEqual(stranded, { recordings: 0, writes: 0, knocks: 0, drafts: 0 });
  assert.ok(!/could not be checked/i.test(signOutMessage(stranded)));
});
