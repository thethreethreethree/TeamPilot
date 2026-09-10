/**
 * Regression tests for the on-device coach answer store.
 *
 * Two of these guard things that would be invisible until they hurt someone:
 *
 *   - a stale answer must not come back as if it were fresh. A suggestion for
 *     "they said it's too expensive" restored a day later is answering a
 *     different customer, and the screen has no way to know unless the store
 *     refuses it.
 *   - one rep's coaching must never be readable by the next person to hold the
 *     phone. Reps share devices; the clear-on-sign-out sweep is the only thing
 *     standing between them, and a sweep that misses a key fails silently.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readAnswer,
  writeAnswer,
  clearAnswer,
  clearAllAnswers,
  SCRATCH_SLOT,
} from '@/lib/sync/coach-answers';

const ANSWER = {
  conversation: 'Customer: your price is too high.',
  guidance: '',
  reply: 'Ask what they are comparing it to before defending the number.',
  reasoning: 'A price objection is usually a value comparison.',
  intel: null,
  mode: 'suggest' as const,
};

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('an answer written comes back whole', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  const got = await readAnswer('rep-1', 'sess-1');
  assert.equal(got?.reply, ANSWER.reply);
  assert.equal(got?.reasoning, ANSWER.reasoning);
  assert.equal(got?.mode, 'suggest');
  assert.ok(got?.at, 'the time it was produced is recorded');
});

test('a missing slot reads as absent, not as an error', async () => {
  assert.equal(await readAnswer('rep-1', 'nothing-here'), null);
});

test('each session gets its own answer', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  await writeAnswer('rep-1', 'sess-2', { ...ANSWER, reply: 'Different session.' });
  assert.equal((await readAnswer('rep-1', 'sess-1'))?.reply, ANSWER.reply);
  assert.equal((await readAnswer('rep-1', 'sess-2'))?.reply, 'Different session.');
});

test('one rep cannot read another rep saved answer', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  assert.equal(await readAnswer('rep-2', 'sess-1'), null);
});

test('an empty answer is never stored', async () => {
  await writeAnswer('rep-1', 'sess-1', { ...ANSWER, reply: '   ', intel: null });
  assert.equal(await readAnswer('rep-1', 'sess-1'), null);
});

test('intel with no reply is still worth keeping', async () => {
  // "Read the prospect" produces intel and no suggested reply. Refusing to
  // store it would mean paying for that call twice.
  await writeAnswer('rep-1', 'sess-1', {
    ...ANSWER,
    reply: '',
    intel: 'They are buying for a team, not themselves.',
    mode: 'dissect',
  });
  const got = await readAnswer('rep-1', 'sess-1');
  assert.equal(got?.intel, 'They are buying for a team, not themselves.');
  assert.equal(got?.mode, 'dissect');
});

test('an answer older than a day is refused, and dropped from disk', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  // Age it by rewriting the stored timestamp, rather than by waiting a day.
  const key = [...(AsyncStorage as unknown as { __raw(): Map<string, string> }).__raw().keys()][0];
  const stored = JSON.parse((await AsyncStorage.getItem(key)) as string);
  stored.at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  await AsyncStorage.setItem(key, JSON.stringify(stored));

  assert.equal(await readAnswer('rep-1', 'sess-1'), null);
  assert.equal(await AsyncStorage.getItem(key), null, 'it is removed, not left to be found later');
});

test('an answer just under a day old still comes back', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  const key = [...(AsyncStorage as unknown as { __raw(): Map<string, string> }).__raw().keys()][0];
  const stored = JSON.parse((await AsyncStorage.getItem(key)) as string);
  stored.at = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  await AsyncStorage.setItem(key, JSON.stringify(stored));

  assert.equal((await readAnswer('rep-1', 'sess-1'))?.reply, ANSWER.reply);
});

test('a corrupt entry reads as absent rather than throwing', async () => {
  await AsyncStorage.setItem('coach.answer.v1.rep-1.sess-1', 'not json at all');
  assert.equal(await readAnswer('rep-1', 'sess-1'), null);
});

test('an entry with an unparseable timestamp is refused', async () => {
  await AsyncStorage.setItem(
    'coach.answer.v1.rep-1.sess-1',
    JSON.stringify({ ...ANSWER, at: 'whenever' }),
  );
  assert.equal(await readAnswer('rep-1', 'sess-1'), null);
});

test('clearing one slot leaves the others alone', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  await writeAnswer('rep-1', SCRATCH_SLOT, ANSWER);
  await clearAnswer('rep-1', 'sess-1');
  assert.equal(await readAnswer('rep-1', 'sess-1'), null);
  assert.ok(await readAnswer('rep-1', SCRATCH_SLOT));
});

test('sign-out sweeps every one of that rep answers', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  await writeAnswer('rep-1', 'sess-2', ANSWER);
  await writeAnswer('rep-1', SCRATCH_SLOT, ANSWER);

  await clearAllAnswers('rep-1');

  assert.equal(await readAnswer('rep-1', 'sess-1'), null);
  assert.equal(await readAnswer('rep-1', 'sess-2'), null);
  assert.equal(await readAnswer('rep-1', SCRATCH_SLOT), null);
});

test('sign-out does not touch the other rep on a shared phone', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  await writeAnswer('rep-2', 'sess-1', { ...ANSWER, reply: 'Belongs to rep two.' });

  await clearAllAnswers('rep-1');

  assert.equal(await readAnswer('rep-1', 'sess-1'), null);
  assert.equal((await readAnswer('rep-2', 'sess-1'))?.reply, 'Belongs to rep two.');
});

test('sign-out leaves unrelated storage alone', async () => {
  // The sweep matches by prefix; a prefix that is too broad would take the
  // session cache and the auth bookkeeping with it.
  await AsyncStorage.setItem('sessions.v1.rep-1', '{"rows":[],"at":"now"}');
  await writeAnswer('rep-1', 'sess-1', ANSWER);

  await clearAllAnswers('rep-1');

  assert.equal(await AsyncStorage.getItem('sessions.v1.rep-1'), '{"rows":[],"at":"now"}');
});

test('a later answer replaces the earlier one for the same session', async () => {
  await writeAnswer('rep-1', 'sess-1', ANSWER);
  await writeAnswer('rep-1', 'sess-1', { ...ANSWER, reply: 'Asked again, better answer.' });
  assert.equal((await readAnswer('rep-1', 'sess-1'))?.reply, 'Asked again, better answer.');
  assert.equal(
    (AsyncStorage as unknown as { __raw(): Map<string, string> }).__raw().size,
    1,
    'replaced, not accumulated',
  );
});

/* ── an oversized conversation ─────────────────────────────────────────── */

test('a huge conversation does not take the answer down with it', async () => {
  // The failure this prevents: the write exceeds quota, the catch swallows it,
  // and the rep loses the coach's reply entirely — silently, having watched it
  // arrive on screen a moment earlier.
  await writeAnswer('rep-1', 'sess-1', {
    ...ANSWER,
    conversation: 'x'.repeat(400_000),
  });

  const got = await readAnswer('rep-1', 'sess-1');
  assert.equal(got?.reply, ANSWER.reply, 'the answer survived');
  assert.equal(got?.reasoning, ANSWER.reasoning, 'and so did its reasoning');
});

test('the conversation is dropped whole, never stored shortened', async () => {
  // A trimmed conversation would restore into the rep's box as though it were
  // what they wrote, quietly shorter. Absent is honest; abridged is not.
  await writeAnswer('rep-1', 'sess-1', {
    ...ANSWER,
    conversation: 'y'.repeat(400_000),
  });

  const got = await readAnswer('rep-1', 'sess-1');
  assert.equal(got?.conversation, '', 'left out entirely, not truncated');
});

test('an ordinary conversation is still stored with its answer', async () => {
  // The ceiling must not be so eager that normal use loses context.
  const conversation = 'Customer: too expensive.\nMe: compared to what?';
  await writeAnswer('rep-1', 'sess-1', { ...ANSWER, conversation });
  assert.equal((await readAnswer('rep-1', 'sess-1'))?.conversation, conversation);
});
