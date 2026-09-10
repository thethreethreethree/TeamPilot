/**
 * Regression tests for which words a rep sees when a screen cannot load.
 *
 * THE BUG BEING GUARDED was in every data screen at once, and it was invisible
 * because each screen LOOKED like it said the right thing. The good sentence was
 * written, and then placed in the fallback position of a ternary whose test was
 * "does this Error have a message" — which is nearly always true. So the good
 * sentence was nearly unreachable and a rep in a dead zone got `Network request
 * failed`.
 *
 * That shape is easy to reintroduce, one screen at a time, by anyone who thinks
 * showing the underlying message is more informative. It is, to a developer.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { humanError, HumanError } from '@/lib/error-message';

const SCREEN = 'Could not reach your numbers. Try again when you have signal.';

/** What the coach API throws: a status, and a message the route wrote. */
function apiError(status: number, message: string): Error {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

test('a dead connection gets the SCREEN sentence, never the library one', () => {
  // The exact strings a phone with no signal produces. Every one of them used to
  // reach the rep verbatim.
  for (const raw of [
    'Network request failed',
    'Failed to fetch',
    'TypeError: Network request failed',
    'The operation couldn’t be completed. (NSURLErrorDomain error -1009.)',
  ]) {
    assert.equal(humanError(new Error(raw), SCREEN), SCREEN, raw);
  }
});

test('a Supabase-style error with no status gets the screen sentence', () => {
  // PostgREST messages are written for whoever wrote the query.
  const e = Object.assign(new Error('relation "coaching_sessions" does not exist'), {
    code: '42P01',
  });
  assert.equal(humanError(e, SCREEN), SCREEN);
});

test('a 4xx from our own API is shown verbatim — it says what to change', () => {
  assert.equal(
    humanError(apiError(400, 'Deal value must be at most 100000000.'), SCREEN),
    'Deal value must be at most 100000000.',
  );
  assert.equal(
    humanError(apiError(403, 'Manager access required.'), SCREEN),
    'Manager access required.',
  );
});

test('a 5xx does NOT reach the rep', () => {
  // True, unhelpful and alarming. The screen's "try again" is the better answer
  // for exactly the case where trying again works.
  for (const status of [500, 502, 503]) {
    assert.equal(humanError(apiError(status, 'Internal Server Error'), SCREEN), SCREEN);
  }
});

test('a synthesised HTTP status is not a sentence', () => {
  // What the client produces when a route returned no body of its own.
  assert.equal(humanError(apiError(404, 'HTTP 404'), SCREEN), SCREEN);
});

test('an empty server message falls back rather than showing nothing', () => {
  assert.equal(humanError(apiError(400, '   '), SCREEN), SCREEN);
});

test('an error this app wrote for the rep survives', () => {
  // No status — it never touched a server — but the words ARE the answer, and
  // the status rule alone would have thrown them away.
  assert.equal(
    humanError(new HumanError('The recording file is missing. Nothing was saved.'), SCREEN),
    'The recording file is missing. Nothing was saved.',
  );
});

test('a HumanError rebuilt across a bundle boundary still survives', () => {
  // Recognised by name as well as by instance. If this ever regressed to
  // instanceof alone, a real message about a lost recording would silently
  // become the generic sentence — with nothing failing anywhere.
  const lookalike = Object.assign(new Error('Nothing was captured.'), { name: 'HumanError' });
  assert.equal(humanError(lookalike, SCREEN), 'Nothing was captured.');
});

test('anything that is not an error at all still produces the screen sentence', () => {
  for (const junk of [null, undefined, 'a string', 42, {}, []]) {
    assert.equal(humanError(junk, SCREEN), SCREEN, String(junk));
  }
});
