/**
 * "Still being turned into a transcript" — for up to forty-seven days.
 *
 * A call whose audio reached the server but whose words never landed told the rep the transcript
 * was on its way and to pull down to check again. The website's recovery sweep recorded what that
 * population actually was on 10 September 2026: nine sessions with saved audio and no transcript,
 * one of them the founder's own test from that morning, the oldest from 25 July. Nothing was coming
 * for any of them.
 *
 * So the load-bearing tests here are the two directions of one boundary — a call that is genuinely
 * still processing must NOT be called failed, and a call that has waited past any honest processing
 * time must NOT still be promised a transcript. Getting the first wrong costs a rep a speech-to-text
 * charge on work already in flight; getting the second wrong is what shipped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TRANSCRIPT_GRACE_MS, transcriptOverdue } from '@/lib/transcript-wait';
import {
  canReReadFrom,
  debriefAvailability,
  unavailableBody,
  unavailableTitle,
  type DebriefAvailability,
} from '@/lib/debrief-availability';

const ENDED = '2026-09-11T10:00:00.000Z';
const at = (msAfterEnd: number) => new Date(Date.parse(ENDED) + msAfterEnd);

const MINUTE = 60_000;

// ---------------------------------------------------------------------------
// The boundary, from both sides

test('a call that just ended is not overdue', () => {
  assert.equal(transcriptOverdue(ENDED, null, at(0)), false);
  assert.equal(transcriptOverdue(ENDED, null, at(30_000)), false);
  assert.equal(transcriptOverdue(ENDED, null, at(5 * MINUTE)), false, 'the platform ceiling itself');
});

test('exactly at the grace it is still waiting; past it, it has failed', () => {
  assert.equal(transcriptOverdue(ENDED, null, at(TRANSCRIPT_GRACE_MS)), false, 'not yet');
  assert.equal(transcriptOverdue(ENDED, null, at(TRANSCRIPT_GRACE_MS + 1)), true);
});

test('the forty-seven-day call is overdue, which is the whole point', () => {
  assert.equal(transcriptOverdue(ENDED, null, at(47 * 24 * 60 * MINUTE)), true);
});

test('the threshold is three times the platform ceiling it is derived from', () => {
  // `maxDuration = 300` on both the recovery route and the recovery cron — five minutes is the
  // longest a batch diarization is permitted to run. A number chosen freehand here would be the
  // same invention this file exists to remove, so the relationship is pinned rather than the value.
  const PLATFORM_CEILING_MS = 300 * 1000;
  assert.equal(TRANSCRIPT_GRACE_MS, PLATFORM_CEILING_MS * 3);
});

// ---------------------------------------------------------------------------
// Not knowing must never become an accusation

test('no timestamp at all leaves the softer sentence', () => {
  assert.equal(transcriptOverdue(null, null, new Date()), false);
  assert.equal(transcriptOverdue(undefined, undefined, new Date()), false);
  assert.equal(transcriptOverdue('', '   ', new Date()), false);
});

test('an unparseable timestamp is not evidence of anything', () => {
  assert.equal(transcriptOverdue('not a date', null, new Date()), false);
});

test('a phone whose clock is behind does not accuse the call of failing', () => {
  // The call appears to be in the future. That is a broken clock, not a broken call, and telling a
  // rep their recording failed because their date is wrong would be a new false claim for an old one.
  assert.equal(transcriptOverdue(ENDED, null, at(-60 * MINUTE)), false);
});

test('started_at is the fallback, and only ever answers LATER than ended_at would', () => {
  const started = '2026-09-11T09:00:00.000Z'; // an hour before the call ended
  assert.equal(transcriptOverdue(null, started, at(0)), true, 'an hour has passed since it began');
  // With both present, the END is what counts: a long call is not overdue partway through it.
  assert.equal(transcriptOverdue(ENDED, started, at(0)), false);
});

// ---------------------------------------------------------------------------
// What the card actually shows

test('audio with no transcript is a wait first and a failure only later', () => {
  assert.equal(debriefAvailability(true, 0, 0, { overdue: false }), 'awaiting-transcript');
  assert.equal(debriefAvailability(true, 0, 0, { overdue: true }), 'transcript-overdue');
});

test('overdue never overrides a call that has no recording at all', () => {
  // There is nothing to re-read, so "the words never came back" would send a rep to a button that
  // cannot help. No recording is the older, simpler, still-correct answer.
  assert.equal(debriefAvailability(false, 0, 0, { overdue: true }), 'no-recording');
});

test('overdue never overrides a call that HAS its words', () => {
  assert.equal(debriefAvailability(true, 12, 0, { overdue: true, agentTurnCount: 6 }), 'ready');
  assert.equal(debriefAvailability(true, 12, 12, { overdue: true }), 'awaiting-voice');
});

test('every caller that does not pass the flag behaves exactly as before', () => {
  assert.equal(debriefAvailability(true, 0), 'awaiting-transcript');
  assert.equal(debriefAvailability(true, 0, 0), 'awaiting-transcript');
  assert.equal(debriefAvailability(false, 0), 'no-recording');
});

// ---------------------------------------------------------------------------
// The words, and the button

test('the overdue message does not promise a transcript, and the waiting one does', () => {
  const waiting = unavailableBody('awaiting-transcript');
  const failed = unavailableBody('transcript-overdue');
  assert.match(waiting, /as soon as that arrives/i, 'the honest wait may still promise');
  assert.doesNotMatch(failed, /still being turned into a transcript/i, 'the sentence that shipped');
  assert.doesNotMatch(failed, /pull down to check again/i, 'seven weeks of pulling down');
  assert.match(failed, /safe/i, 'the recording is not lost and the rep must be told so');
  assert.match(failed, /nothing you did/i, 'and that it was not their fault');
});

test('each state says something different — a shared sentence is two causes reading as one', () => {
  const states: Exclude<DebriefAvailability, 'ready'>[] = [
    'awaiting-voice',
    'agent-missing',
    'awaiting-transcript',
    'transcript-overdue',
    'no-recording',
  ];
  const titles = new Set(states.map(unavailableTitle));
  const bodies = new Set(states.map(unavailableBody));
  assert.equal(titles.size, states.length);
  assert.equal(bodies.size, states.length);
});

test('the re-read is offered only once the wait is over', () => {
  assert.equal(canReReadFrom('transcript-overdue'), true);
  assert.equal(canReReadFrom('awaiting-transcript'), false, 'the work may still be in flight');
  assert.equal(canReReadFrom('no-recording'), false, 'there is nothing to read');
  assert.equal(canReReadFrom('awaiting-voice'), false, 'the words are already here');
  assert.equal(canReReadFrom('ready'), false);
});

// ---------------------------------------------------------------------------
// The mirror image: only the CUSTOMER was recorded
//
// Three calls in the founder's company hold nothing but the other person's voice. Every coaching
// engine filters on `speaker === 'agent'`, so the transcript reads as empty to all of them — and
// the card said "nothing came back… that can mean there was little in the call, or the coach did
// not finish". It was neither, and the app already held what it needed to say so: the segments are
// on the screen it is rendering.

test('a transcript with words but none of them the rep is named, not guessed at', () => {
  assert.equal(
    debriefAvailability(true, 14, 0, { agentTurnCount: 0 }),
    'agent-missing',
  );
});

test('NOT ASKED is not the same as none — or every call would be agent-missing', () => {
  // The reason `agentTurnCount` is absent rather than 0 by default. A caller that does not count
  // agent turns must keep its old behaviour exactly.
  assert.equal(debriefAvailability(true, 14, 0), 'ready');
  assert.equal(debriefAvailability(true, 14, 0, {}), 'ready');
  assert.equal(debriefAvailability(true, 14, 0, { overdue: true }), 'ready');
});

test('an unlabelled transcript stays a question, not a verdict', () => {
  // The rep may BE one of the unknown voices, and `awaiting-voice` already asks. Declaring
  // agent-missing here would tell them their side was never recorded when it may be right there.
  assert.equal(debriefAvailability(true, 14, 14, { agentTurnCount: 0 }), 'awaiting-voice');
  assert.equal(debriefAvailability(true, 14, 3, { agentTurnCount: 0 }), 'ready');
});

test('a call with the rep in it is untouched', () => {
  assert.equal(debriefAvailability(true, 14, 0, { agentTurnCount: 7 }), 'ready');
  assert.equal(debriefAvailability(true, 14, 0, { agentTurnCount: 1 }), 'ready');
});

test('the customer-only message says whose voice is missing and that the recording is safe', () => {
  const body = unavailableBody('agent-missing');
  assert.doesNotMatch(body, /not enough/i, 'the call is full of words');
  assert.doesNotMatch(body, /did not finish/i, 'the coach did not fail — it had nothing of the rep to read');
  assert.match(body, /safe/i);
  assert.match(body, /read again|read a second time/i);
});

test('the re-read is offered for it, because the route covers customer-only', () => {
  assert.equal(canReReadFrom('agent-missing'), true);
});
