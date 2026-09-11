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
  assert.match(
src,
    /ATTRIBUTION_IS_FINAL\}/,
    'declared but never rendered is the same as absent',
  );
});

test('it says the two things a rep has to know', () => {
  // That it cannot be undone, and what a wrong tap actually does - a rep who is told only
  // "permanent" does not know why it matters enough to read the quoted line first.
  assert.match(src, /cannot be changed afterwards/);
  assert.match(src, /backwards/);
});

test('BOTH paths warn, because both answers are final', () => {
  /*
    THE CORRECTION THIS TEST REPLACES, and it was mine.

    The first version of this asserted the OPPOSITE: that a one-voice call must NOT be warned,
    because its "not me" answer writes zero agent turns and a later recovery could replace it. That
    reasoning was taken from `/label-transcript`. The one-voice answer does not go there — it goes to
    `/attribute-unlabelled`, which updates the rows with `source: "manual"` and then refuses any
    transcript already carrying that, across three separate 409s. Both one-voice answers are final,
    and the old test actively pinned the more damaging one as unwarned.

    It is not hypothetical. A recovered call came back the same day with 317 segments and 6,861
    words — a real two-person conversation — every row labelled `unknown` because the diarizer never
    separated the voices. A call like that is shown the ONE-VOICE question, where both answers are
    wrong and the wrong one sticks.
  */
  assert.match(src, /export const ATTRIBUTION_IS_FINAL =/);
  assert.match(src, /export const SOLO_ATTRIBUTION_IS_FINAL =/);

  // Rendered unconditionally: a ternary picking the wording, never a branch that skips it.
  assert.match(
    src,
    /\{solo \? SOLO_ATTRIBUTION_IS_FINAL : ATTRIBUTION_IS_FINAL\}/,
    'the warning must render on both paths — only the wording differs',
  );
  assert.doesNotMatch(
    src,
    /\{solo \? null :/,
    'a solo-skips-the-warning branch is the bug this test exists for',
  );
});

test('the one-voice wording fits the one-voice risk', () => {
  // There is no "wrong voice" to pick when only one is offered; the danger is that the answer
  // applies to every line at once. Reusing the two-voice sentence would describe a choice the rep
  // is not being given.
  assert.match(src, /applies to every line/);
  assert.match(src, /cannot be changed afterwards/);
});
