/**
 * Regression tests for what a 401 actually meant.
 *
 * THE FAILURE: every 401 was read as "the backend is not deployed yet".
 *
 * That is correct most of the time and catastrophic in the case that matters —
 * a rep removed from the company, or who changed their password, or whose
 * refresh token was revoked. Every screen tells them to wait for a deploy. They
 * wait. No deploy will ever fix it, because the answer was "sign in again".
 *
 * The tie-break, when the app genuinely cannot tell, is deliberately 'route':
 * wrongly throwing a working rep back to a login screen costs them whatever
 * they were holding, and is much the more expensive mistake.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { authFailureMessage, classify401 } from '@/lib/auth-failure';

const NOW = 1_760_000_000_000;
const inSeconds = (s: number) => ({ expiresAt: Math.floor(NOW / 1000) + s });

test('no session at all means signed out', () => {
  assert.equal(classify401(null, NOW), 'signed-out');
});

test('an expired token means signed out — the refresh already failed', () => {
  assert.equal(classify401(inSeconds(-60), NOW), 'signed-out');
});

test('a live session means the ROUTE refused it, not the rep', () => {
  assert.equal(classify401(inSeconds(3600), NOW), 'route');
});

test('a token expiring this very second is treated as signed out', () => {
  assert.equal(classify401({ expiresAt: Math.floor(NOW / 1000) }, NOW), 'signed-out');
});

test('an unknown expiry falls to ROUTE, never to signing someone out', () => {
  // The deliberate tie-break: guessing "signed out" throws a working rep back
  // to a login screen and loses what they were holding.
  assert.equal(classify401({ expiresAt: null }, NOW), 'route');
});

test('the signed-out message says what to do AND that nothing is lost', () => {
  const m = authFailureMessage('signed-out');
  assert.match(m, /sign in again/i);
  assert.match(m, /nothing you recorded is lost/i);
});

test('the route message says plainly that retrying will not help', () => {
  // Otherwise a rep pulls to refresh all day against a route that cannot answer.
  const m = authFailureMessage('route');
  assert.match(m, /will not help/i);
  assert.ok(!/sign in again to see/i.test(m));
});

test('the route message does NOT blame a deploy that has already happened', () => {
  // It used to say "this needs a change on the website that has not gone live". True while the coach routes were
  // cookie-only; false once they all accepted a phone token — and this sentence is shown at nearly every 401 in
  // the app, so it was wrong in many places at once. The message must say what the rep can do (nothing) without
  // naming a cause the app cannot see.
  const m = authFailureMessage('route');
  assert.ok(!/has not gone live/i.test(m), 'must not promise a deploy that has already shipped');
  assert.ok(!/not available on the phone yet/i.test(m));
  assert.match(m, /nothing you recorded is lost/i);
});
