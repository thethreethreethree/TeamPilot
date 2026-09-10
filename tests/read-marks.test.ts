/**
 * Regression tests for the chat's unread state.
 *
 * A BADGE THAT CANNOT BE CLEARED IS WORSE THAN NO BADGE. It trains a rep to
 * ignore it, and then the one that matters goes unread too. So the cases that
 * matter here are all the ones where "unread" would be a guess:
 *
 *   - a topic the rep is NOT in has no readable messages, so it cannot be unread
 *     to them — the badge would be permanent;
 *   - a topic with no messages has nothing to be unread;
 *   - a marker must never move BACKWARDS, or opening an old topic would
 *     resurrect messages the rep has already dealt with.
 *
 * And one that is the opposite failure: a message that arrives while the rep is
 * reading must not be marked read just because they had the screen open. That is
 * why the marker is set to the newest message ON SCREEN, never to `now`.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearReadMarks, isUnread, markRead, readMarks } from '@/lib/chat/read-marks';

const REP = 'rep-1';
const T = 'topic-1';
const EARLY = '2026-09-03T10:00:00.000Z';
const LATE = '2026-09-03T18:00:00.000Z';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('a topic never opened, with messages in it, is unread', async () => {
  const marks = await readMarks(REP);
  assert.equal(isUnread({ joined: true, lastMessageAt: LATE }, marks, T), true);
});

test('a topic the rep is NOT in is never unread', async () => {
  // They cannot read its messages at all, so the badge could never be cleared.
  const marks = await readMarks(REP);
  assert.equal(isUnread({ joined: false, lastMessageAt: LATE }, marks, T), false);
});

test('a topic with no messages is never unread', async () => {
  const marks = await readMarks(REP);
  assert.equal(isUnread({ joined: true, lastMessageAt: null }, marks, T), false);
});

test('reading clears it, and a later message brings it back', async () => {
  await markRead(REP, T, EARLY);
  let marks = await readMarks(REP);
  assert.equal(isUnread({ joined: true, lastMessageAt: EARLY }, marks, T), false);
  // Somebody replies.
  assert.equal(isUnread({ joined: true, lastMessageAt: LATE }, marks, T), true);

  await markRead(REP, T, LATE);
  marks = await readMarks(REP);
  assert.equal(isUnread({ joined: true, lastMessageAt: LATE }, marks, T), false);
});

test('a marker never moves backwards', async () => {
  // Opening an older topic after a newer read would otherwise resurrect
  // messages the rep has already dealt with.
  await markRead(REP, T, LATE);
  await markRead(REP, T, EARLY);
  const marks = await readMarks(REP);
  assert.equal(marks[T], LATE);
  assert.equal(isUnread({ joined: true, lastMessageAt: LATE }, marks, T), false);
});

test('marking with nothing on screen does not mark anything read', async () => {
  // An empty thread carries no evidence that anything was seen.
  await markRead(REP, T, null);
  const marks = await readMarks(REP);
  assert.equal(marks[T], undefined);
});

test('topics are tracked separately', async () => {
  await markRead(REP, T, LATE);
  const marks = await readMarks(REP);
  assert.equal(isUnread({ joined: true, lastMessageAt: LATE }, marks, 'topic-2'), true);
});

test('one rep never sees another rep’s read state', async () => {
  await markRead(REP, T, LATE);
  const other = await readMarks('rep-2');
  assert.deepEqual(other, {});
});

test('sign-out clears them', async () => {
  await markRead(REP, T, LATE);
  await clearReadMarks(REP);
  assert.deepEqual(await readMarks(REP), {});
});

test('a corrupt store fails towards UNREAD, not towards read', async () => {
  // The safe direction: a rep is shown a topic they have already read, rather
  // than never being shown one they have not.
  await AsyncStorage.setItem(`chat-read.v1.${REP}`, '{not json');
  const marks = await readMarks(REP);
  assert.deepEqual(marks, {});
  assert.equal(isUnread({ joined: true, lastMessageAt: LATE }, marks, T), true);
});

test('a non-string entry is ignored rather than trusted', async () => {
  await AsyncStorage.setItem(`chat-read.v1.${REP}`, JSON.stringify({ [T]: 12345 }));
  const marks = await readMarks(REP);
  assert.equal(marks[T], undefined);
  assert.equal(isUnread({ joined: true, lastMessageAt: LATE }, marks, T), true);
});
