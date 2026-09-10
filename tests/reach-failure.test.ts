/**
 * The message that told a rep on full Wi-Fi to go and find signal.
 *
 * The tests that matter are the ones that pin the NEGATIVE: that the app does
 * not name the signal as the cause when it has not established that the signal
 * is the cause. Loosening the rule breaks a named test rather than quietly
 * returning the app to blaming the network for everything.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { failureCause, reachError, reachFallback } from '@/lib/reach-failure';

const err = (status?: number) => Object.assign(new Error('boom'), status === undefined ? {} : { status });

test('a server that answered and broke is NEVER reported as a signal problem', () => {
  // The reported bug: full bars, fast internet, "try again when you have signal".
  const msg = reachError(err(500), true, 'the coach');
  assert.ok(!/when you have signal/i.test(msg), 'a 5xx on a good connection still blamed the signal');
  assert.match(msg, /server's end, not your connection/);
});

test('a phone that is genuinely offline still gets the original, correct sentence', () => {
  const msg = reachError(err(), false, 'the coach');
  assert.match(msg, /no connection/);
  assert.match(msg, /when you have signal/);
});

test('online but unreachable says both known facts and guesses at neither', () => {
  const msg = reachError(err(), true, 'your numbers');
  assert.match(msg, /connection is fine/);
  assert.ok(!/when you have signal/i.test(msg), 'it told a connected rep to find signal');
  // It must not assert the server is down either — that is not established.
  assert.ok(!/the server is down|server is offline/i.test(msg), 'it asserted an unverified cause');
});

test('an unknown connection state counts as online, never as offline', () => {
  // null is the first few milliseconds after mount. Telling a rep on good
  // signal that they have none is the worse of the two errors.
  assert.equal(failureCause(err(), null), 'unreachable');
  assert.notEqual(failureCause(err(), null), 'offline');
});

test('any HTTP status means a server answered, so the signal is exonerated', () => {
  for (const s of [400, 403, 404, 500, 502, 503]) {
    assert.equal(failureCause(err(s), false), 'server', `status ${s} was not treated as a server answer`);
  }
});

test('a non-numeric status is not mistaken for a server answer', () => {
  for (const bad of [{ status: '500' }, { status: null }, { status: Number.NaN }, {}]) {
    assert.equal(failureCause(bad, false), 'offline', `${JSON.stringify(bad)} was read as a status`);
  }
});

test('every cause ends in something the rep can actually do', () => {
  for (const cause of ['offline', 'server', 'unreachable'] as const) {
    const msg = reachFallback('the coach', cause);
    assert.match(msg, /try again|somebody needs to look/i, `${cause} left the rep with no next step`);
    assert.match(msg, /the coach/, `${cause} lost what was being reached`);
  }
});

test('an empty subject never produces a sentence with a hole in it', () => {
  const msg = reachFallback('   ', 'offline');
  assert.ok(!/reach  |reach\./.test(msg), 'the subject was left blank in the sentence');
  assert.match(msg, /the server/);
});

test('a sentence a server wrote for a person still wins over the fallback', () => {
  // The near-miss in this very fix: routing around humanError reads better and
  // throws away the only message that says what to change.
  const denied = Object.assign(new Error('Manager access required'), { status: 403 });
  assert.equal(reachError(denied, true, 'your team'), 'Manager access required');
});

test('a 5xx does NOT show its own body, because "Internal Server Error" helps nobody', () => {
  const boom = Object.assign(new Error('Internal Server Error'), { status: 500 });
  const msg = reachError(boom, true, 'the coach');
  assert.ok(!msg.includes('Internal Server Error'));
  assert.match(msg, /server's end/);
});

test('a 502 the server WROTE is shown, because it says what actually failed', () => {
  // The coach's generative routes answer an LLM failure with {error, kind} and a
  // 502, deliberately. Suppressing it left "try again when you have signal" on a
  // phone with full bars while the server was explaining itself.
  const llm = Object.assign(new Error('The model refused: context length exceeded.'), {
    status: 502,
    kind: 'upstream',
  });
  assert.equal(reachError(llm, true, 'the coach'), 'The model refused: context length exceeded.');
});

test('a plain 5xx with no label is still suppressed', () => {
  // Nothing here changed: "Internal Server Error" is true, unhelpful, alarming.
  const plain = Object.assign(new Error('Internal Server Error'), { status: 500 });
  const msg = reachError(plain, true, 'the coach');
  assert.ok(!msg.includes('Internal Server Error'));
  assert.match(msg, /server's end/);
});

test('an empty or non-string kind does not unlock a 5xx body', () => {
  for (const kind of ['', '   ', 42, null, undefined]) {
    const e = Object.assign(new Error('Internal Server Error'), { status: 500, kind });
    assert.ok(
      !reachError(e, true, 'the coach').includes('Internal Server Error'),
      `kind ${JSON.stringify(kind)} leaked a raw 5xx body`,
    );
  }
});
