/**
 * Regression tests for where an unsent chat message is kept.
 *
 * TWO RULES, both of which look like details and are not.
 *
 * The first: holding a draft again must NOT refresh its timestamp. The window
 * that decides whether to send silently measures from when the rep FIRST tried.
 * A phone that re-holds on every retry would reset that clock forever, and could
 * deliver a message an hour late into a conversation that had moved on.
 *
 * The second: this survives sign-out. It is the same rule as the door knocks —
 * the sweep clears copies of things the server already has, and these are words
 * the server has never seen. This phone holds the only copy.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearDraft, draftsHeld, holdDraft, readDraft } from '@/lib/chat/draft-store';

const REP = 'rep-1';
const TOPIC = 'topic-1';
const T0 = 1_760_000_000_000;

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('nothing held reads as nothing', async () => {
  assert.equal(await readDraft(REP, TOPIC), null);
});

test('a held message comes back with its words and its time', async () => {
  await holdDraft(REP, TOPIC, 'On my way', T0);
  assert.deepEqual(await readDraft(REP, TOPIC), { body: 'On my way', at: T0 });
});

test('re-holding keeps the ORIGINAL timestamp', async () => {
  // Otherwise every retry resets the clock and the message can never go stale,
  // so it lands an hour late in a thread that has moved on.
  await holdDraft(REP, TOPIC, 'On my way', T0);
  await holdDraft(REP, TOPIC, 'On my way', T0 + 60_000);
  assert.equal((await readDraft(REP, TOPIC))?.at, T0);
});

test('re-holding DOES take the newer words', async () => {
  await holdDraft(REP, TOPIC, 'On my way', T0);
  await holdDraft(REP, TOPIC, 'On my way — 10 minutes', T0 + 1000);
  const held = await readDraft(REP, TOPIC);
  assert.equal(held?.body, 'On my way — 10 minutes');
  assert.equal(held?.at, T0);
});

test('an empty message is not held', async () => {
  await holdDraft(REP, TOPIC, '   ', T0);
  assert.equal(await readDraft(REP, TOPIC), null);
});

test('a sent message is cleared', async () => {
  await holdDraft(REP, TOPIC, 'On my way', T0);
  await clearDraft(REP, TOPIC);
  assert.equal(await readDraft(REP, TOPIC), null);
});

test('topics are held separately', async () => {
  await holdDraft(REP, TOPIC, 'first', T0);
  await holdDraft(REP, 'topic-2', 'second', T0);
  assert.equal((await readDraft(REP, TOPIC))?.body, 'first');
  assert.equal((await readDraft(REP, 'topic-2'))?.body, 'second');
  await clearDraft(REP, TOPIC);
  assert.equal((await readDraft(REP, 'topic-2'))?.body, 'second');
});

test('one rep never sees another rep’s unsent words', async () => {
  await holdDraft(REP, TOPIC, 'private', T0);
  assert.equal(await readDraft('rep-2', TOPIC), null);
  assert.equal(await draftsHeld('rep-2'), 0);
});

test('a corrupt record reads as nothing held rather than throwing', async () => {
  await AsyncStorage.setItem(`chat-draft.v1.${REP}.${TOPIC}`, '{not json');
  assert.equal(await readDraft(REP, TOPIC), null);
});

test('a record with no timestamp is refused rather than guessed', async () => {
  // Inventing "now" would restart the staleness window on corrupt data.
  await AsyncStorage.setItem(
    `chat-draft.v1.${REP}.${TOPIC}`,
    JSON.stringify({ body: 'hello' }),
  );
  assert.equal(await readDraft(REP, TOPIC), null);
});

test('the count reports how many topics hold unsent words', async () => {
  await holdDraft(REP, TOPIC, 'a', T0);
  await holdDraft(REP, 'topic-2', 'b', T0);
  assert.equal(await draftsHeld(REP), 2);
  await clearDraft(REP, TOPIC);
  assert.equal(await draftsHeld(REP), 1);
});

test('signing out does NOT throw away words the rep typed', async () => {
  // Same rule as the door knocks. The sweep clears copies of things the server
  // already has; an unposted message is not a copy of anything — this phone
  // holds the only one. Losing it at sign-out would silently destroy something
  // a person wrote and was told was safe.
  const { sweepDeviceCopies } = await import('@/lib/sign-out-flow');
  await holdDraft(REP, TOPIC, 'I will call them back tomorrow', T0);

  await sweepDeviceCopies(REP);

  assert.equal(
    (await readDraft(REP, TOPIC))?.body,
    'I will call them back tomorrow',
    'the sign-out sweep destroyed an unposted message',
  );
});

test('the sign-out warning counts unposted messages', async () => {
  const { strandedAtSignOut, signOutMessage } = await import('@/lib/sign-out-flow');
  await holdDraft(REP, TOPIC, 'On my way', T0);
  const stranded = await strandedAtSignOut(REP);
  assert.equal(stranded.drafts, 1);
  // A rep who is not told assumes a message they typed was sent.
  assert.match(signOutMessage(stranded), /message you typed has not been posted/i);
});

test('the warning says nothing about messages when there are none', async () => {
  const { strandedAtSignOut, signOutMessage } = await import('@/lib/sign-out-flow');
  const stranded = await strandedAtSignOut(REP);
  assert.equal(stranded.drafts, 0);
  assert.ok(!/typed/i.test(signOutMessage(stranded)));
});
