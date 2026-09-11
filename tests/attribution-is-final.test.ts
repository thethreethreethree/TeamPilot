/**
 * THE ONE-TIME ANSWER MUST SAY THAT IT IS ONE-TIME.
 *
 * WHAT IS AT STAKE. "Which voice is you?" writes an append-only canonical transcript through
 * `label-transcript`. Once that transcript holds agent turns it is NEVER clobbered - a second
 * attempt is refused with 409 and the words "This session already has a transcript - start a new
 * session to log a different call", which is useless advice about a call that already happened.
 *
 * So tapping the wrong voice attributes every line backwards, permanently. The coach then reads the
 * customer's objections as the rep's, and talk ratio, questions and listening are all measured on
 * the wrong person - on a transcript that looks entirely normal afterwards. Nothing in the product
 * would ever trace it back to the tap.
 *
 * The picker was already careful in every other way: no default, no guess, each option leading with
 * a real line from the call, and its own comment saying a wrong attribution is worse than none. It
 * simply never mentioned that there is no second go. That is the same defect class as a re-read
 * button that named its price only after the price was paid.
 *
 * SOURCE-LEVEL (A33): the component imports react-native and cannot be rendered in this runner, and
 * what is being protected is that a sentence reaches the screen at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/components/speaker-picker.tsx'), 'utf8');

test('the warning exists and reaches the screen', () => {
  assert.match(src, /export const ATTRIBUTION_IS_FINAL =/);
  assert.match(src, /\{ATTRIBUTION_IS_FINAL\}/, 'declared but never rendered is the same as absent');
});

test('it says the two things a rep has to know', () => {
  // That it cannot be undone, and what a wrong tap actually does - a rep who is told only
  // "permanent" does not know why it matters enough to read the quoted line first.
  assert.match(src, /cannot be changed afterwards/);
  assert.match(src, /backwards/);
});

test('it is NOT shown on a one-voice call, where it would be false', () => {
  /*
    THE HALF THAT IS EASY TO GET WRONG, and it is wrong in the opposite direction.

    A solo call's "not me" answer writes a transcript with ZERO agent turns, and the route's one
    narrow exception lets a recovery re-transcribe replace exactly that. So that answer genuinely is
    not final. Telling a rep it cannot be undone would be a fabricated constraint - and this project
    treats a confident wrong reason as the failure, whichever way it points.
  */
  const guard = src.indexOf('{solo ? null : (');
  const render = src.indexOf('{ATTRIBUTION_IS_FINAL}');
  assert.notEqual(guard, -1, 'the warning must be gated on there being two voices');
  assert.ok(guard < render, 'the solo guard must wrap the warning, not sit after it');
  assert.ok(render - guard < 300, 'the guard must be the one wrapping this warning');
});
