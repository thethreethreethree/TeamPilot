/**
 * Regression tests for what a rep is told when sign-in fails.
 *
 * TWO THINGS ARE BEING GUARDED, and they pull in opposite directions.
 *
 * The first is that a rep must be able to ACT on what they are told. A phone
 * with one bar and a wrong password produce completely different next steps —
 * walk outside, or try a different password — and the app used to give the same
 * developer-facing string for the first and a clear sentence for the second. So
 * the connection case, the rate limit and the unconfirmed account each have to
 * survive as their own answer.
 *
 * The second is that the screen must never become an ORACLE. "No account with
 * that email" and "wrong password" have to be indistinguishable, because the
 * sign-in screen is public and the difference between those two answers is a way
 * to enumerate who works at a company. That is the test that must never be
 * relaxed to make a message friendlier.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signInMessage, CREDENTIALS_MESSAGE } from '@/lib/sign-in-message';

test('every credential failure gets the SAME answer', () => {
  // Real strings Supabase auth returns for these cases. If any of them ever
  // produces a different sentence from the others, the screen has become a way
  // to find out which email addresses have accounts.
  const credentialFailures = [
    'Invalid login credentials',
    'invalid_grant',
    'User not found',
    'Bad credentials',
  ];
  for (const raw of credentialFailures) {
    assert.equal(signInMessage(raw), CREDENTIALS_MESSAGE, raw);
  }
});

test('the credential answer never says whether the account exists', () => {
  const said = CREDENTIALS_MESSAGE.toLowerCase();
  for (const leak of ['no account', 'not found', 'no user', "doesn't exist", 'does not exist']) {
    assert.ok(!said.includes(leak), `leaks "${leak}"`);
  }
});

test('a connection failure is named as one, not as a password problem', () => {
  for (const raw of [
    'Network request failed',
    'AuthRetryableFetchError: Failed to fetch',
    'The request timed out',
    'connection refused',
  ]) {
    const said = signInMessage(raw);
    assert.notEqual(said, CREDENTIALS_MESSAGE, raw);
    // The point of this branch: the rep is told it is NOT their password, so
    // they stop retyping it and go and find signal.
    assert.match(said, /connection|signal/i, raw);
  }
});

test('a rate limit says to wait, and says why waiting matters', () => {
  const said = signInMessage('Too many requests');
  assert.match(said, /wait/i);
  // Without this, the rep hammers the button and extends their own lockout.
  assert.match(said, /longer|again/i);
});

test('an unconfirmed account is distinguished from a wrong password', () => {
  const said = signInMessage('Email not confirmed');
  assert.notEqual(said, CREDENTIALS_MESSAGE);
  assert.match(said, /confirm/i);
});

test('a disabled account is distinguished too', () => {
  const said = signInMessage('User is banned');
  assert.notEqual(said, CREDENTIALS_MESSAGE);
  assert.match(said, /active|cannot sign in/i);
});

test('an unrecognised failure never reaches the rep verbatim', () => {
  // The exact shape of the old bug: a class name shown to someone standing in a
  // stairwell, reading as the app being broken.
  for (const raw of ['AuthApiError', 'ECONNRESET', 'unexpected_failure', 'x']) {
    const said = signInMessage(raw);
    assert.ok(!said.includes(raw), `passed "${raw}" through`);
    // Still actionable, and still not blaming the rep's password.
    assert.match(said, /try again/i, raw);
  }
});

test('no message at all still produces a sentence', () => {
  for (const raw of [null, undefined, '']) {
    const said = signInMessage(raw);
    assert.ok(said.length > 0);
    assert.match(said, /try again/i);
  }
});

test('every message is a sentence a person can act on', () => {
  const all = [
    signInMessage('Invalid login credentials'),
    signInMessage('Network request failed'),
    signInMessage('Too many requests'),
    signInMessage('Email not confirmed'),
    signInMessage('User is banned'),
    signInMessage('something else entirely'),
  ];
  for (const said of all) {
    // No developer vocabulary reaching a rep, in any branch.
    assert.ok(!/error|exception|null|undefined|http|\d{3}\b/i.test(said), said);
    assert.ok(said.endsWith('.'), `not a sentence: ${said}`);
  }
});
