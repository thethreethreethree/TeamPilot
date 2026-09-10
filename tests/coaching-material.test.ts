/**
 * The "Learn" guide, and the empty states that must not look like faults.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  NO_MATERIAL,
  isUnavailable,
  materialUnavailable,
  readCoachingMaterial,
} from '@/lib/coaching-material';
import { blockedState } from '@/lib/blocked-state';

const full = {
  material: {
    overview: 'Let the objection land before answering.',
    keyMoves: ['Pause for a beat', 'Repeat the objection back'],
    watchOuts: ['Talking over the last word'],
    exampleLines: ['"So the price feels high — is that the whole of it?"'],
  },
};

test('a complete guide is read through intact', () => {
  const m = readCoachingMaterial(full);
  assert.equal(m?.overview, 'Let the objection land before answering.');
  assert.equal(m?.keyMoves.length, 2);
  assert.equal(m?.watchOuts.length, 1);
  assert.equal(m?.exampleLines.length, 1);
});

test('the route\'s deliberate empty answer is null, not a broken guide', () => {
  // The route returns {material:null} on a malformed or empty generation, on
  // purpose. That is a real state, not a failure.
  assert.equal(readCoachingMaterial({ material: null }), null);
  assert.equal(readCoachingMaterial(null), null);
  assert.equal(readCoachingMaterial(undefined), null);
  assert.equal(readCoachingMaterial({}), null);
});

test('a guide with every field empty is treated as absent', () => {
  // Four empty headings read as a broken screen, not as a coach with nothing
  // to add.
  assert.equal(
    readCoachingMaterial({ material: { overview: '  ', keyMoves: [], watchOuts: [], exampleLines: [] } }),
    null,
  );
});

test('a partial guide is kept — some help beats none', () => {
  const m = readCoachingMaterial({ material: { overview: '', keyMoves: ['Pause first'] } });
  assert.equal(m?.keyMoves[0], 'Pause first');
  assert.equal(m?.overview, '');
  assert.deepEqual(m?.watchOuts, []);
});

test('blank and non-string list entries are dropped rather than rendered', () => {
  const m = readCoachingMaterial({
    material: { overview: 'x', keyMoves: ['  ', 'Real move', 42, null], watchOuts: 'not a list' },
  });
  assert.deepEqual(m?.keyMoves, ['Real move']);
  assert.deepEqual(m?.watchOuts, []);
});

test('the empty-state sentence does not blame the rep', () => {
  assert.ok(!/you (failed|have not|did not)/i.test(NO_MATERIAL));
  assert.match(NO_MATERIAL, /Practising it still works/);
});

test('a route that refuses the app is NOT reported as "nothing to say"', () => {
  // The route still authenticates by cookie, so it refuses the phone until that
  // is changed. Telling a rep their coach has nothing for a skill, when really
  // the request never landed, is a lie they might repeat to their manager.
  for (const status of [401, 403, 404]) {
    assert.equal(isUnavailable({ status }), true, `status ${status}`);
  }
  /**
   * THIS ASSERTION USED TO PIN THE LIE.
   *
   * It read `assert.match(MATERIAL_UNAVAILABLE, /has not gone live/)` — locking
   * in the claim that this route "needs a change on the website that has not
   * gone live yet". That was true once and stopped being true when the route
   * gained `resolveApiAuth`; the test then held the stale sentence in place and
   * is part of why nobody noticed for so long.
   *
   * What actually matters is pinned instead: the two sentences must differ, and
   * the unavailable one must NOT promise a deploy that has already happened.
   */
  for (const why of ['signed-out', 'route'] as const) {
    const unavailable = blockedState(why, 'this guide').body;
    assert.notEqual(unavailable, NO_MATERIAL, `${why} reads as "nothing to say"`);
    assert.ok(
      !/has not gone live|not deployed|coming soon/i.test(unavailable),
      `${why} still promises a pending deploy`,
    );
  }

  // And the two causes are told apart, because they have opposite fixes.
  assert.notEqual(blockedState('signed-out', 'this guide').body, blockedState('route', 'this guide').body);
});

test('an ordinary failure is not dressed up as a deployment problem', () => {
  // A 500 or a dead connection is not "the website needs changing".
  assert.equal(isUnavailable({ status: 500 }), false);
  assert.equal(isUnavailable(new Error('network')), false);
  assert.equal(isUnavailable(null), false);
});

test('the unavailable sentence still tells the rep what DOES work', () => {
  /**
   * This test earned its place on 4 September. Replacing the old sentence with
   * the shared blocked paragraph fixed a false claim about the server AND
   * silently dropped this reassurance — a true reason traded for a lost one.
   * The test failed, and the reassurance came back.
   */
  for (const why of ['signed-out', 'route'] as const) {
    const text = materialUnavailable(blockedState(why, 'this guide').body);
    assert.match(text, /Practising the skill works now/, `${why} lost the reassurance`);
  }
});
