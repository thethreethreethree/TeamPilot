/**
 * Whether a call has come back from the coach — and the state that renders nothing.
 *
 * The list could not answer the question a rep asks every day. Adding it is easy; adding it HONESTLY is the part
 * worth testing, because the count can fail to arrive, and a chip saying "being analysed" when the truth is "we
 * could not check" is a confident answer to a question nobody answered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYSIS_WINDOW_MS,
  analysisChip,
  analysisSpoken,
  analysisState,
  transcriptWaitBody,
  transcriptWaitTitle,
} from '@/lib/session-analysis';

test('audio with no segments yet is still being analysed', () => {
  assert.equal(analysisState(true, 0), 'analysing');
  assert.equal(analysisChip('analysing'), 'Being analysed');
});

test('audio with segments has come back', () => {
  assert.equal(analysisState(true, 1), 'analysed');
  assert.equal(analysisState(true, 240), 'analysed');
});

test('a session with no audio says nothing — there is nothing to analyse', () => {
  assert.equal(analysisState(false, 0), 'no-audio');
  assert.equal(analysisState(false, null), 'no-audio');
  assert.equal(analysisChip('no-audio'), null);
});

test('a count that could not be read is UNKNOWN, and unknown renders nothing', () => {
  // The load-bearing one. When the embedded count fails the caller falls back to
  // a plain read, and the app then does not know. Saying "being analysed" there
  // would be inventing a fact — the same defect as a zero for a figure nobody
  // could read.
  for (const missing of [null, undefined, Number.NaN]) {
    assert.equal(analysisState(true, missing as number | null), 'unknown', `${missing} was treated as a count`);
  }
  assert.equal(analysisChip('unknown'), null);
  assert.equal(analysisSpoken('unknown'), null);
});

test('a finished call wears no badge — the transcript is the badge', () => {
  // A chip on every completed row would be noise on the screen a rep scrolls
  // most. The chip answers "why is this one empty", which stops being a question
  // the moment it is not.
  assert.equal(analysisChip('analysed'), null);
  assert.equal(analysisSpoken('analysed'), null);
});

test('the screen reader hears a sentence, not a fragment', () => {
  assert.equal(analysisSpoken('analysing'), 'still being analysed');
});

// ---------------------------------------------------------------------------
// The window: when "being analysed" stops being something we can stand behind
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-09-04T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test('inside the window it is still being analysed', () => {
  assert.equal(analysisState(true, 0, ago(60_000), NOW), 'analysing');
  assert.equal(analysisState(true, 0, ago(ANALYSIS_WINDOW_MS - 1), NOW), 'analysing');
});

test('past the window it says there is NO TRANSCRIPT — not that anything failed', () => {
  // Nobody has checked. The pipeline can be backed up, and a call recorded
  // offline is uploaded only when signal returns. What is certainly true is that
  // there is no transcript, so that is all it claims.
  const state = analysisState(true, 0, ago(ANALYSIS_WINDOW_MS + 1), NOW);
  assert.equal(state, 'stalled');
  assert.equal(analysisChip(state), 'No transcript yet');
  assert.ok(!/fail|wrong|error|lost/i.test(analysisChip(state) ?? ''), 'the chip claims a failure');
});

test('the window is the SAME five minutes the detail screen gives up after', () => {
  // Two answers to one question on two screens is how a rep gets told a call is
  // in progress on one and finished on the other.
  assert.equal(ANALYSIS_WINDOW_MS, 5 * 60 * 1000);
});

test('an unreadable or future timestamp falls back to the GENTLER answer', () => {
  // A clock that cannot be trusted is no reason to tell a rep something may be
  // wrong with their call.
  for (const bad of ['not a date', '', null, undefined]) {
    assert.equal(analysisState(true, 0, bad, NOW), 'analysing', `${bad} was not handled gently`);
  }
  assert.equal(analysisState(true, 0, new Date(NOW + 60_000).toISOString(), NOW), 'analysing');
});

test('a finished call is analysed however old it is', () => {
  assert.equal(analysisState(true, 12, ago(90 * 24 * 60 * 60 * 1000), NOW), 'analysed');
});

test('with no timestamp at all the answer is unchanged from before', () => {
  // The argument is optional; callers that cannot supply it get exactly the
  // behaviour they had.
  assert.equal(analysisState(true, 0), 'analysing');
});

// ---------------------------------------------------------------------------
// What the session screen says when there is no transcript
// ---------------------------------------------------------------------------

test('a call that was already stale on arrival is not described as "after five minutes"', () => {
  // The screen used to say that whatever the truth. Opening a three-week-old
  // call, it polled twenty times, said nothing for five minutes, and then
  // reported the five minutes it had just spent as if that were the wait.
  assert.equal(transcriptWaitTitle('arrived-stale'), 'This call has no transcript');
  assert.ok(!/five minutes/.test(transcriptWaitTitle('arrived-stale')));
  assert.equal(transcriptWaitTitle('waited'), 'Still no transcript after five minutes');
});

test('both messages promise the recording is safe, because that is the actual worry', () => {
  for (const reason of ['waited', 'arrived-stale'] as const) {
    assert.match(transcriptWaitBody(reason), /recording is safe/i, `${reason} does not reassure`);
    assert.match(transcriptWaitBody(reason), /pull down/i, `${reason} offers no way to retry`);
  }
});

test('neither message claims the call failed or was lost', () => {
  for (const reason of ['waited', 'arrived-stale'] as const) {
    const text = `${transcriptWaitTitle(reason)} ${transcriptWaitBody(reason)}`;
    assert.ok(!/\b(failed|lost|deleted|gone|error)\b/i.test(text), `${reason} claims a failure`);
  }
});

test('the stale message says WHY nothing is happening', () => {
  // A screen showing no activity is indistinguishable from a broken one unless
  // it says it has stopped on purpose.
  assert.match(transcriptWaitBody('arrived-stale'), /not going to keep checking/i);
});
