/**
 * The door vocabulary, which the pitch screens were not using.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { PITCH_OUTCOME_LABEL, pitchOutcomeLabel } from '@/lib/doors/outcome-label';

test('every door outcome reads as words, never as a database value', () => {
  // The bug this exists to stop: the pitch screens read the SESSION map, where
  // only `sold` matches, so a rep saw "go_back" and "non_decision_maker".
  for (const [key, label] of Object.entries(PITCH_OUTCOME_LABEL)) {
    assert.ok(!label.includes('_'), `${key} rendered with an underscore: ${label}`);
    assert.notEqual(label, key, `${key} fell through to the raw value`);
  }
});

test('the wording matches the Door Log buttons a rep already taps', () => {
  assert.equal(pitchOutcomeLabel('go_back'), 'Go back');
  assert.equal(pitchOutcomeLabel('non_decision_maker'), 'Not the decision maker');
  assert.equal(pitchOutcomeLabel('not_interested'), 'Not interested');
  assert.equal(pitchOutcomeLabel('no_answer'), 'No answer');
  assert.equal(pitchOutcomeLabel('sold'), 'Sold');
});

test('an outcome the app has never heard of is still readable', () => {
  // The server may add one. A rep should read words, not a column value.
  assert.equal(pitchOutcomeLabel('left_message'), 'Left message');
  assert.equal(pitchOutcomeLabel('call_back_tuesday'), 'Call back tuesday');
});

test('a missing outcome says so rather than showing an empty gap', () => {
  assert.equal(pitchOutcomeLabel(null), 'Outcome not recorded');
  assert.equal(pitchOutcomeLabel(undefined), 'Outcome not recorded');
  assert.equal(pitchOutcomeLabel(''), 'Outcome not recorded');
  assert.equal(pitchOutcomeLabel('___'), 'Outcome not recorded');
});

test("the server's literal 'unknown' stays 'Outcome not recorded'", () => {
  // All three maps this module replaced carried this. Humanising it to
  // "Unknown" would read as a recorded outcome rather than an absent one —
  // a regression introduced by the very change that removed the duplicates.
  assert.equal(pitchOutcomeLabel('unknown'), 'Outcome not recorded');
});
