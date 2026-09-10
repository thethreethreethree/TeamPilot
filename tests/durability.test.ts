/**
 * A decision that was quietly reopened is worse than one nobody recorded.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { durabilityIsWarning, durabilityLine } from '@/lib/chat/durability';

test('each recorded outcome reads as a sentence, not a database word', () => {
  assert.equal(durabilityLine('held'), 'What was decided held.');
  assert.match(durabilityLine('reopened') ?? '', /did not hold/);
  assert.match(durabilityLine('partial') ?? '', /did not stick/);
});

test('an unreviewed outcome says nothing at all', () => {
  // null and 'unknown' both mean "nobody has judged this yet". Printing
  // "unknown" puts a word on screen that a rep reads as a verdict on the
  // decision, which it is not.
  assert.equal(durabilityLine(null), null);
  assert.equal(durabilityLine(undefined), null);
  assert.equal(durabilityLine('unknown'), null);
});

test('a value this app has never seen is silent rather than raw', () => {
  // The column is constrained today, but a future value must not surface as a
  // bare identifier in the middle of a sentence about a rep's own team.
  assert.equal(durabilityLine('superseded'), null);
  assert.equal(durabilityLine(''), null);
});

test('reopened and partial are flagged; held and unknown are not', () => {
  // "Held" is good news and must not be dressed as a warning; "unknown" is not
  // news at all.
  assert.equal(durabilityIsWarning('reopened'), true);
  assert.equal(durabilityIsWarning('partial'), true);
  assert.equal(durabilityIsWarning('held'), false);
  assert.equal(durabilityIsWarning('unknown'), false);
  assert.equal(durabilityIsWarning(null), false);
});
