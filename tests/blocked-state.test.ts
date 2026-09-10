/**
 * The paragraph ten screens used to write for themselves.
 *
 * The old copy said "the server does not accept the app's sign-in yet. Nothing is wrong with your account." Both
 * halves became false: the routes accept the app now, and for a rep whose session expired something IS wrong with
 * their account — one they can fix in five seconds, while the app told them not to bother.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blockedState, uploadBlockedMessage } from '@/lib/blocked-state';

test('a signed-out rep is told to sign in, and that nothing is lost', () => {
  const s = blockedState('signed-out', 'your skills');
  assert.match(s.body, /sign in again/i);
  assert.match(s.body, /nothing you recorded is lost/i);
  assert.ok(!/nothing is wrong with your account/i.test(s.body), 'something IS wrong — their session ended');
});

test('a signed-out rep is never told that retrying will not help', () => {
  // Signing in again is precisely what helps. This is the sentence the old copy got backwards on every screen.
  const s = blockedState('signed-out', 'your numbers');
  assert.ok(!/will not help/i.test(s.body));
});

test('a route refusal says retrying will not help, without naming a cause', () => {
  const s = blockedState('route', 'your numbers');
  assert.match(s.body, /will not help/i);
  assert.ok(!/not switched on yet/i.test(s.title + s.body));
  assert.ok(!/has not gone live/i.test(s.body), 'must not promise a deploy that has already shipped');
  assert.ok(!/does not accept the app/i.test(s.body));
});

test('a route refusal names what the rep was looking at', () => {
  // So it reads as being about their screen rather than a system-wide announcement.
  assert.match(blockedState('route', "today's doors").body, /today's doors/);
  assert.match(blockedState('route', 'your skills').body, /your skills/);
});

test('an unclassifiable failure is treated as a route refusal, never as signed-out', () => {
  // Guessing "signed out" throws a working rep at a login screen and loses what they were holding — much the more
  // expensive of the two mistakes.
  assert.deepEqual(blockedState(null, 'your numbers'), blockedState('route', 'your numbers'));
});

test('the two cases are genuinely different text, not one message with a swapped word', () => {
  const a = blockedState('signed-out', 'your numbers');
  const b = blockedState('route', 'your numbers');
  assert.notEqual(a.title, b.title);
  assert.notEqual(a.body, b.body);
});

test('a signed-out rep with an unsent recording is told the FILE is safe and to sign in', () => {
  // The order matters: a rep who has just recorded a real conversation needs to know the file survived before
  // anything else. And signing in is the fix — the old sentence, "Sending is not switched on yet", told them to
  // wait for a switch that had already been flipped.
  const m = uploadBlockedMessage('signed-out');
  assert.match(m, /safe on this phone/i);
  assert.match(m, /sign in again/i);
  assert.ok(!/not switched on yet/i.test(m));
});

test('a route refusal on an upload still promises the file is safe, and does not say to sign in', () => {
  const m = uploadBlockedMessage('route');
  assert.match(m, /safe on this phone/i);
  assert.match(m, /will not help/i);
  assert.ok(!/sign in again/i.test(m), 'signing in cannot fix a route that refuses a live token');
});

test('an unclassifiable upload failure is a route refusal, never signed-out', () => {
  assert.equal(uploadBlockedMessage(null), uploadBlockedMessage('route'));
  assert.notEqual(uploadBlockedMessage(null), uploadBlockedMessage('signed-out'));
});
