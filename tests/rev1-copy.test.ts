/**
 * REV 1 (2026-09-11) — the copy the founder specified, and the two traps in it.
 *
 * These are user-facing sentences the founder wrote themselves, so the tests hold what they asked
 * for rather than what I would have written. Two of them are load-bearing beyond taste:
 *
 *   1. The Macro Mode switch must say something DIFFERENT in each position. It said one line in
 *      both, describing the app's own furniture instead of answering the only question a rep has
 *      about it - is this the switch for the way I sell?
 *   2. The focus count must be ONE number. It now appears on the Door Log and on Today's Metrics,
 *      and two copies is how a rep reads "your next five doors" on one screen and "your next ten"
 *      on the other.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MACRO_OFF_BODY,
  MACRO_ON_BODY,
  MACRO_UNSYNCED,
  macroModeBody,
} from '@/lib/doors/macro-mode-copy';
import {
  FOCUS_HEADING,
  FOCUS_HINT,
  FOCUS_PENDING,
  NEXT_DOORS,
} from '@/lib/doors/door-screen-view';

// ---------------------------------------------------------------------------
// The switch answers "is this for the way I sell?"

test('each position says something different, and neither describes the tab bar', () => {
  assert.notEqual(macroModeBody(true), macroModeBody(false));
  [macroModeBody(true), macroModeBody(false)].forEach((line) => {
    assert.doesNotMatch(line, /tab bar|Door Log and a macro/i, 'the old line described the furniture');
  });
});

test('ON is the short-form, door-knocking side', () => {
  // Which way round this goes is the one ambiguity in REV 1 — the note says "on" for both. It is
  // resolved from the product: Macro Mode is what turns the Door Log on, and fiber and pest control
  // are door-knocking industries. macro-mode-copy.ts records the reasoning; this pins the result, so
  // if it is backwards the fix is two strings and this test, and nothing else.
  assert.equal(macroModeBody(true), MACRO_ON_BODY);
  assert.match(MACRO_ON_BODY, /short form/i);
  assert.match(MACRO_ON_BODY, /15 minutes/);
  assert.match(MACRO_ON_BODY, /Fiber internet/i);
  assert.match(MACRO_ON_BODY, /Pest Control/i);
});

test('OFF is the long-form side', () => {
  assert.equal(macroModeBody(false), MACRO_OFF_BODY);
  assert.match(MACRO_OFF_BODY, /Long form/i);
  assert.match(MACRO_OFF_BODY, /20 minutes/);
  assert.match(MACRO_OFF_BODY, /Solar/i);
});

test('the unsynced note is its own sentence, not glued to the explanation', () => {
  // It used to be appended to whichever description was showing, which made a fact about SAVING
  // read as part of what the mode is for.
  [MACRO_ON_BODY, MACRO_OFF_BODY].forEach((line) => {
    assert.ok(!line.includes(MACRO_UNSYNCED), 'the two must not be one string');
  });
  assert.match(MACRO_UNSYNCED, /this phone/i);
});

// ---------------------------------------------------------------------------
// One number, in one place

test('the focus is five doors, and the heading and the hint both say so', () => {
  assert.equal(NEXT_DOORS, 5);
  assert.ok(FOCUS_HEADING.includes(String(NEXT_DOORS)), 'the heading names the count');
  assert.ok(FOCUS_HINT.includes(String(NEXT_DOORS)), 'and so does the hint');
  // Ten was the old number and it lived only on Today's Metrics.
  assert.doesNotMatch(FOCUS_HINT, /\bten\b/i);
});

test('the heading is the founder’s own words', () => {
  assert.equal(FOCUS_HEADING, 'Next 5 door focus');
});

test('the empty state does not tell a rep their work is missing', () => {
  assert.doesNotMatch(FOCUS_PENDING, /nothing to show|no data|error|failed/i);
  assert.match(FOCUS_PENDING, /analysed|analyzed/i, 'it says what it is waiting ON');
});
