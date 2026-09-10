/**
 * Regression tests for a chat message that did not send.
 *
 * THE BUG: the screen promised "your message will send itself when you have
 * one", and then kept it in component state. Backing out of the thread threw it
 * away. A rep who typed a reply at a door with no signal, read that sentence and
 * tapped back had lost their words — after being told they were safe.
 *
 * The rule these tests pin down is that the WORDS are never discarded. The
 * five-minute window only stops the app sending them silently; it never deletes
 * them, because a reply landing an hour into a moved-on conversation is a
 * different problem from losing what somebody wrote.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { draftAction, restoreMessage, RETRY_WINDOW_MS } from '@/lib/chat/draft';

const NOW = 1_760_000_000_000;
const held = (body: string, agoMs = 0) => ({ body, at: NOW - agoMs });

test('online and fresh sends itself', () => {
  const a = draftAction(held('On my way'), { online: true, now: NOW });
  assert.equal(a.kind, 'send');
  assert.equal(a.kind === 'send' && a.body, 'On my way');
});

test('offline holds the words rather than losing them', () => {
  const a = draftAction(held('On my way'), { online: false, now: NOW });
  assert.equal(a.kind, 'restore');
  assert.equal(a.kind === 'restore' && a.body, 'On my way');
  assert.equal(a.kind === 'restore' && a.because, 'offline');
});

test('past the window it is restored, NOT discarded', () => {
  // The whole point. The window stops the automatic send; it never deletes.
  const a = draftAction(held('Sorry, running late', RETRY_WINDOW_MS + 1000), {
    online: true,
    now: NOW,
  });
  assert.equal(a.kind, 'restore');
  assert.equal(a.kind === 'restore' && a.body, 'Sorry, running late');
  assert.equal(a.kind === 'restore' && a.because, 'stale');
});

test('exactly at the window is still sent', () => {
  const a = draftAction(held('x', RETRY_WINDOW_MS), { online: true, now: NOW });
  assert.equal(a.kind, 'send');
});

test('stale beats offline', () => {
  // Once the thread has moved on, having signal again does not make a silent
  // send the right thing.
  const a = draftAction(held('old', RETRY_WINDOW_MS * 3), { online: false, now: NOW });
  assert.equal(a.kind === 'restore' && a.because, 'stale');
});

test('nothing held is nothing to do', () => {
  assert.deepEqual(draftAction(null, { online: true, now: NOW }), { kind: 'none' });
});

test('a whitespace-only draft is not a message', () => {
  assert.equal(draftAction(held('   '), { online: true, now: NOW }).kind, 'none');
});

test('both restore messages say the words are still here', () => {
  // A rep must be able to tell, from the sentence alone, that nothing was lost.
  for (const because of ['stale', 'offline'] as const) {
    assert.match(restoreMessage(because), /still here/i);
  }
});

test('the offline message does not claim the thread moved on', () => {
  assert.ok(!/moved on/i.test(restoreMessage('offline')));
});

test('a held reply keeps its target when it is sent automatically', () => {
  const a = draftAction({ body: 'Yes, agreed', at: 1000, replyToId: 'm7' }, { online: true, now: 1500 });
  assert.equal(a.kind, 'send');
  assert.equal((a as { replyToId: string | null }).replyToId, 'm7');
});

test('a restored reply keeps its target too, offline and stale alike', () => {
  const offline = draftAction({ body: 'Yes', at: 1000, replyToId: 'm7' }, { online: false, now: 1500 });
  assert.equal((offline as { replyToId: string | null }).replyToId, 'm7');
  const stale = draftAction(
    { body: 'Yes', at: 0, replyToId: 'm7' },
    { online: true, now: 10 * 60 * 1000 },
  );
  assert.equal(stale.kind, 'restore');
  assert.equal((stale as { replyToId: string | null }).replyToId, 'm7');
});

test('a draft written before replies existed still sends, as top-level', () => {
  // THE upgrade case: an unsent draft held by an older build has no replyToId.
  // It must not throw and must not invent a target — it always was top-level.
  const a = draftAction({ body: 'Older words', at: 1000 }, { online: true, now: 1500 });
  assert.equal(a.kind, 'send');
  assert.equal((a as { replyToId: string | null }).replyToId, null);
});

test('an explicitly top-level draft reports null, never undefined', () => {
  // The screen passes this straight to the insert; undefined would let
  // PostgREST apply a default instead of writing an explicit null.
  const a = draftAction({ body: 'Top level', at: 1000, replyToId: null }, { online: true, now: 1500 });
  assert.equal((a as { replyToId: string | null }).replyToId, null);
});

test('a pre-upgrade draft restored OFFLINE also reports null, not undefined', () => {
  // The online path was covered; this branch was not. The declared type is
  // `string | null`, and undefined would slip through to the insert where
  // PostgREST treats an absent column differently from an explicit null.
  const a = draftAction({ body: 'Older words', at: 1000 }, { online: false, now: 1500 });
  assert.equal(a.kind, 'restore');
  assert.equal((a as { replyToId: string | null }).replyToId, null);
  assert.notEqual((a as { replyToId: string | null }).replyToId, undefined);
});
