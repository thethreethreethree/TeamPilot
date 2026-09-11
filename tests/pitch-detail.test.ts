/**
 * Regression tests for the per-pitch detail's four honest states.
 *
 * THE ONE THAT MATTERS MOST is `lost`: a pitch that COMPLETED but whose analysis
 * never saved. The obvious code — `analysis ? ready : processing` — shows that
 * rep "still processing", and it is not. The pitch is terminal. The spinner
 * resolves never, and the rep keeps reopening the screen to check.
 *
 * The web carries the same guard with an audit note (H3) beside it, which is how
 * this app knows the failure is real rather than theoretical.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  analysisState,
  canRolePlay,
  dimensionLabel,
  orderedScores,
  pitchStillProcessing,
  scoreWidth,
  type PitchDetail,
} from '@/lib/pitch-detail';

const ANALYSIS = {
  summary: 'Strong open, lost them on price.',
  strengths: ['Warm open'],
  improvements: ['Anchor value before price'],
  scores: { rapport: 80, price_framing: 40 },
};

function pitch(over: Partial<PitchDetail> = {}): PitchDetail {
  return {
    id: 'p1',
    name: '14 Oak St',
    status: 'complete',
    error: null,
    recordedAt: '2026-09-03T14:00:00Z',
    outcome: 'sold',
    transcript: 'Hi there…',
    analysis: ANALYSIS,
    ...over,
  };
}

test('a completed pitch whose analysis never saved is LOST, not processing', () => {
  // The spinner would never resolve. This is the whole reason the module exists.
  const s = analysisState(pitch({ status: 'complete', analysis: null }));
  assert.equal(s.kind, 'lost');
});

test('a pitch still running IS processing', () => {
  assert.equal(analysisState(pitch({ status: 'processing', analysis: null })).kind, 'processing');
  assert.equal(analysisState(pitch({ status: 'transcribing', analysis: null })).kind, 'processing');
});

test('a failed pitch reports its real reason', () => {
  const s = analysisState(pitch({ status: 'failed', analysis: null, error: 'Audio too quiet' }));
  assert.equal(s.kind, 'failed');
  assert.equal(s.kind === 'failed' && s.message, 'Audio too quiet');
});

test('a failed pitch with no reason still says something', () => {
  // An empty failure bubble is worse than no card at all.
  const s = analysisState(pitch({ status: 'failed', analysis: null, error: null }));
  assert.equal(s.kind === 'failed' && s.message.length > 0, true);
  const blank = analysisState(pitch({ status: 'failed', analysis: null, error: '   ' }));
  assert.equal(blank.kind === 'failed' && blank.message.trim().length > 0, true);
});

test('failure beats a present analysis', () => {
  // A failed pitch that somehow carries an analysis row is still a failure; the
  // rep must not be shown scores for a pitch the system could not process.
  assert.equal(analysisState(pitch({ status: 'failed' })).kind, 'failed');
});

test('an analysis that is there is READY', () => {
  const s = analysisState(pitch());
  assert.equal(s.kind, 'ready');
  assert.equal(s.kind === 'ready' && s.analysis.summary, ANALYSIS.summary);
});

test('role play is offered only when there is a transcript to rebuild from', () => {
  // Without one the coach would invent a customer, which is the opposite of
  // "run this same pitch back".
  assert.equal(canRolePlay(pitch()), true);
  assert.equal(canRolePlay(pitch({ transcript: null })), false);
  assert.equal(canRolePlay(pitch({ transcript: '   ' })), false);
});

test('role play is never offered on a failed or unfinished pitch', () => {
  assert.equal(canRolePlay(pitch({ status: 'failed' })), false);
  assert.equal(canRolePlay(pitch({ status: 'processing' })), false);
});

test('a score bar never paints outside its track', () => {
  assert.equal(scoreWidth(150), 100);
  assert.equal(scoreWidth(-20), 0);
  assert.equal(scoreWidth(62), 62);
  // Garbage is not a score. `orderedScores` drops these before they reach a
  // bar, but if one ever did, an EMPTY bar is the safe wrong answer — clamping
  // Infinity to 100 would paint a perfect score out of corrupt data.
  assert.equal(scoreWidth(Number.NaN), 0);
  assert.equal(scoreWidth(Number.POSITIVE_INFINITY), 0);
});

test('scores are ordered the same way for every pitch', () => {
  // Insertion order would let two pitches list the same dimensions differently,
  // and a rep comparing them would read position as meaning.
  const a = orderedScores({ ...ANALYSIS, scores: { rapport: 1, close: 2 } });
  const b = orderedScores({ ...ANALYSIS, scores: { close: 2, rapport: 1 } });
  assert.deepEqual(a.map((s) => s.dimension), b.map((s) => s.dimension));
  assert.deepEqual(a.map((s) => s.dimension), ['close', 'rapport']);
});

test('a non-numeric score is dropped rather than rendered as a bar', () => {
  const rows = orderedScores({
    ...ANALYSIS,
    scores: { rapport: 80, broken: 'high' as unknown as number, missing: Number.NaN },
  });
  assert.deepEqual(rows.map((r) => r.dimension), ['rapport']);
});

test('an empty score set is empty, not a crash', () => {
  assert.deepEqual(orderedScores({ ...ANALYSIS, scores: {} }), []);
});

test('dimension names read as English', () => {
  assert.equal(dimensionLabel('price_framing'), 'Price framing');
  assert.equal(dimensionLabel('objection-handling'), 'Objection handling');
  assert.equal(dimensionLabel('rapport'), 'Rapport');
});

// ---------------------------------------------------------------------------
// The list and the detail screen must agree about the same pitch
//
// They did not. `pitches.tsx` carried its own copy of this condition —
// `status !== 'analyzed' && status !== 'failed'` — which omits `'complete'`. So a pitch that had
// FINISHED with no analysis saved was told, on the list, "Still being analysed. The summary appears
// here when it is done", while the detail screen read the same row and called it `lost`.
//
// This file's own header already warned against exactly that sentence: "Saying 'still processing'
// here shows a spinner that will never resolve — the rep waits forever for a thing that is not
// coming." The warning was written, and then the list was built with a second copy of the rule that
// ignored it. That is the duplicated-rule failure, with the documentation on the losing side.

test('a FINISHED pitch with no analysis is not "still being analysed"', () => {
  // The case the list got wrong, and the whole reason the rule is now shared.
  assert.equal(pitchStillProcessing('complete', false), false);
});

test('the two surfaces reach the same verdict from the same row', () => {
  const base: PitchDetail = {
    id: 'p1',
    name: 'Door, Thu 10 Sep at 4:53 PM',
    status: 'complete',
    error: null,
    recordedAt: '2026-09-10T16:53:00.000Z',
    outcome: 'sold',
    transcript: 'some words',
    analysis: null,
  };
  // Detail: lost. List: not processing. Neither leaves the rep waiting.
  assert.equal(analysisState(base).kind, 'lost');
  assert.equal(pitchStillProcessing(base.status, Boolean(base.analysis)), false);
});

test('a pitch that really is still moving still says so', () => {
  assert.equal(pitchStillProcessing('pending', false), true);
  assert.equal(pitchStillProcessing('transcribing', false), true);
  // An unknown status is treated as still moving, which is the right way to be wrong: it waits
  // rather than declaring a failure the app cannot actually see.
  assert.equal(pitchStillProcessing('some-new-status', false), true);
});

test('an analysis that exists is never "still being analysed"', () => {
  assert.equal(pitchStillProcessing('pending', true), false);
  assert.equal(pitchStillProcessing('analyzed', true), false);
});

test('a failed pitch is not processing either — it has its own sentence', () => {
  assert.equal(pitchStillProcessing('failed', false), false);
  assert.equal(analysisState({
    id: 'p2', name: 'n', status: 'failed', error: 'Speech service was down',
    recordedAt: '2026-09-10T16:53:00.000Z', outcome: 'no_sale', transcript: null, analysis: null,
  }).kind, 'failed');
});
