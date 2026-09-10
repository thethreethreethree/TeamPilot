/**
 * Counting what is stranded on the phone, in a way that can say "I do not know".
 *
 * THE DISTINCTION THIS FILE DEFENDS is between an empty store and an unreadable
 * one. Every other reader in the app collapses them, which is right for a list
 * screen and wrong for the sign-out warning: that message speaks only when a
 * count is above zero, so a failure returning 0 does not soften it, it deletes
 * it — and a rep walks away believing nothing is waiting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countKeysWithPrefix, countStored } from '@/lib/stranded-count';

const reader = (value: string | null) => async () => value;
const thrower = () => async () => {
  throw new Error('storage is unavailable');
};

test('a stored list is counted', async () => {
  assert.equal(await countStored(reader('[]'), 'k'), 0);
  assert.equal(await countStored(reader('[1,2,3]'), 'k'), 3);
});

test('a MISSING key is zero, because that emptiness is real and knowable', async () => {
  // A rep who has never logged a door has no key. Telling them "we could not
  // check" would be a false alarm on the commonest case there is.
  assert.equal(await countStored(reader(null), 'k'), 0);
});

test('a store that THROWS is unknown, never zero', async () => {
  assert.equal(await countStored(thrower(), 'k'), null);
});

test('content that is not a list is unknown, not empty', async () => {
  // The key holds something this app did not write, so what is stranded is
  // genuinely unknowable rather than nothing.
  assert.equal(await countStored(reader('{"a":1}'), 'k'), null);
  assert.equal(await countStored(reader('not json at all'), 'k'), null);
  assert.equal(await countStored(reader('7'), 'k'), null);
});

test('keys are counted by prefix, and only the matching ones', async () => {
  const keys = async () => [
    'chat-draft.v1.rep-1.topic-a',
    'chat-draft.v1.rep-1.topic-b',
    'chat-draft.v1.rep-2.topic-a',
    'knocks.v1.rep-1',
  ];
  assert.equal(await countKeysWithPrefix(keys, 'chat-draft.v1.rep-1.'), 2);
  assert.equal(await countKeysWithPrefix(keys, 'chat-draft.v1.rep-3.'), 0);
});

test('an unreadable key list is unknown, never zero', async () => {
  const keys = async () => {
    throw new Error('storage is unavailable');
  };
  assert.equal(await countKeysWithPrefix(keys, 'chat-draft.v1.rep-1.'), null);
});
