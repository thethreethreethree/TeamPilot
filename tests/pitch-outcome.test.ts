/**
 * A recorded pitch cannot have ended in "no answer".
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { PITCH_OUTCOMES, isPitchOutcome } from '@/lib/doors/pitch-outcome';
import { KNOCK_OUTCOMES } from '@/lib/doors/knock-store';

test('a recorded pitch offers four outcomes, never "no answer"', () => {
  // Somebody opened the door and the rep talked to them. The server enforces
  // this too — its pitch schema has four values — so offering the fifth would
  // be a 400 AFTER the conversation is over, when the audio cannot be re-taken.
  assert.equal(PITCH_OUTCOMES.length, 4);
  assert.equal(PITCH_OUTCOMES.some((p) => p.outcome === ('no_answer' as never)), false);
});

test('it is exactly the door-log list minus no_answer', () => {
  // Derived from the same vocabulary rather than retyped, so a new outcome on
  // the server cannot leave these two lists disagreeing silently.
  const knock = KNOCK_OUTCOMES.filter((o) => o !== 'no_answer');
  assert.deepEqual(PITCH_OUTCOMES.map((p) => p.outcome), knock);
});

test('Sold leads, because it is the one nobody wants to fumble', () => {
  assert.equal(PITCH_OUTCOMES[0].outcome, 'sold');
  assert.equal(PITCH_OUTCOMES[0].lead, true);
});

test('the guard accepts the four and refuses everything else', () => {
  for (const p of PITCH_OUTCOMES) assert.equal(isPitchOutcome(p.outcome), true);
  assert.equal(isPitchOutcome('no_answer'), false);
  assert.equal(isPitchOutcome('sold_out'), false);
  assert.equal(isPitchOutcome(null), false);
  assert.equal(isPitchOutcome(undefined), false);
  assert.equal(isPitchOutcome(''), false);
});

test('every outcome has a label a rep would say out loud', () => {
  for (const p of PITCH_OUTCOMES) {
    assert.ok(p.label.trim().length > 0, `${p.outcome} has no label`);
    assert.ok(!p.label.includes('_'), `${p.outcome} shows a database value`);
  }
});
