/**
 * Regression tests for seeding a roleplay from a real pitch.
 *
 * TWO FAILURES, and the second one breaks the exact button the rep pressed.
 *
 * The first is the honesty one: when the customer cannot be rebuilt, the screen
 * must say it is a general practice. Carrying on under the "practise this pitch"
 * banner would have a rep rehearsing an invented objection while believing they
 * had rehearsed the real one.
 *
 * The second is the length caps. The roleplay route validates customPrompt and
 * focus at 600 characters and REJECTS an over-long body with a 400 — it does not
 * trim. A situation reconstructed from a forty-minute transcript goes past 600
 * easily, so an unclamped seed makes "practise this pitch" fail on its first
 * turn: the feature broken by the thing meant to make it good.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CUSTOM_PROMPT,
  MAX_FOCUS,
  MAX_PERSONA,
  focusSeed,
  roleplaySeed,
} from '@/lib/roleplay-seed';

test('a rebuilt customer becomes a replay', () => {
  const seed = roleplaySeed({
    scenario: { persona: 'Guarded homeowner, burned by a previous installer', situation: 'Evening doorstep, kids inside' },
    focus: 'Anchor value before price',
  });
  assert.equal(seed.kind, 'replay');
  assert.equal(seed.kind === 'replay' && seed.persona.startsWith('Guarded homeowner'), true);
  assert.equal(seed.kind === 'replay' && seed.situation, 'Evening doorstep, kids inside');
  assert.equal(seed.kind === 'replay' && seed.focus, 'Anchor value before price');
});

test('no scenario means a PLAIN practice, said out loud', () => {
  // The route returns this deliberately when the pitch has no transcript.
  const seed = roleplaySeed({ scenario: null });
  assert.equal(seed.kind, 'plain');
  assert.equal(seed.kind === 'plain' && seed.reason.length > 0, true);
});

test('a null response is a plain practice, not a crash', () => {
  assert.equal(roleplaySeed(null).kind, 'plain');
});

test('a scenario with no persona cannot be a replay', () => {
  // There is no customer to play. Claiming otherwise is the lie.
  assert.equal(roleplaySeed({ scenario: { situation: 'A doorstep' } }).kind, 'plain');
  assert.equal(roleplaySeed({ scenario: { persona: '   ' } }).kind, 'plain');
  assert.equal(roleplaySeed({ scenario: { persona: null } }).kind, 'plain');
});

test('an over-long situation is clamped below the route’s limit', () => {
  // Unclamped, the route 400s and the whole practice run dies on turn one.
  const long = 'word '.repeat(400);
  const seed = roleplaySeed({ scenario: { persona: 'A homeowner', situation: long } });
  assert.equal(seed.kind, 'replay');
  assert.equal(seed.kind === 'replay' && (seed.situation?.length ?? 0) <= MAX_CUSTOM_PROMPT, true);
  assert.equal(seed.kind === 'replay' && (seed.situation?.length ?? 0) > 0, true);
});

test('an over-long persona and focus are clamped too', () => {
  const seed = roleplaySeed({
    scenario: { persona: 'x'.repeat(500), situation: null },
    focus: 'y '.repeat(500),
  });
  assert.equal(seed.kind === 'replay' && seed.persona.length <= MAX_PERSONA, true);
  assert.equal(seed.kind === 'replay' && (seed.focus?.length ?? 0) <= MAX_FOCUS, true);
});

test('clamping stops at a word boundary rather than mid-word', () => {
  const seed = roleplaySeed({
    scenario: { persona: 'A '.repeat(400), situation: null },
  });
  assert.equal(seed.kind === 'replay' && seed.persona.endsWith('A'), true);
});

test('a persona that is one enormous word is still clamped', () => {
  // The word-boundary preference must never win by returning nothing.
  const seed = roleplaySeed({ scenario: { persona: 'z'.repeat(900), situation: null } });
  assert.equal(seed.kind === 'replay' && seed.persona.length, MAX_PERSONA);
});

test('an empty situation or focus becomes null, not an empty string', () => {
  // An empty customPrompt would still be sent, adding a blank line to the
  // prompt for no reason.
  const seed = roleplaySeed({ scenario: { persona: 'A homeowner', situation: '  ' }, focus: '' });
  assert.equal(seed.kind === 'replay' && seed.situation, null);
  assert.equal(seed.kind === 'replay' && seed.focus, null);
});

test('a replay with no focus is still a replay', () => {
  // The customer is the point; the focus is a bonus the route treats as optional.
  const seed = roleplaySeed({ scenario: { persona: 'A homeowner' } });
  assert.equal(seed.kind, 'replay');
  assert.equal(seed.kind === 'replay' && seed.focus, null);
});

test('a growth area from Training becomes a practice focus', () => {
  assert.equal(
    focusSeed('You interrupt when a prospect raises price'),
    'You interrupt when a prospect raises price',
  );
});

test('an empty focus yields null rather than an unusable practice', () => {
  // A practice that carries no focus would be scored against nothing, while
  // telling the rep they are being scored on the skill they picked.
  assert.equal(focusSeed(''), null);
  assert.equal(focusSeed('   '), null);
  assert.equal(focusSeed(null), null);
  assert.equal(focusSeed(undefined), null);
});

test('a long growth area is trimmed to the limit the route accepts', () => {
  // Rejected server-side for length AFTER the rep has done the practice is the
  // worst possible moment to find out.
  const long = 'x'.repeat(MAX_FOCUS + 200);
  const seeded = focusSeed(long);
  assert.ok(seeded && seeded.length <= MAX_FOCUS);
});

test('trimming prefers a word boundary rather than cutting mid-word', () => {
  const words = ('objection handling '.repeat(60)).trim();
  const seeded = focusSeed(words);
  assert.ok(seeded && !seeded.endsWith('objec'), 'cut mid-word');
});
