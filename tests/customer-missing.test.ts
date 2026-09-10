/**
 * A call where only the rep's voice was recorded — and the button that could never fix it.
 *
 * THE DEFECT THESE PIN. When the mic catches the rep and not the person at the door, the transcript
 * holds one voice, so the coach has no conversation to read and the debrief comes back blank. That
 * call still HAS scores — `talk_ratio` (carrying its data-capture caveat) and `question_rate` are
 * both computed from the agent side alone — so `emptyReadReason` read "scores present, write-up
 * empty" and classified it as `engine-blank`, which offers "Build it again". Rebuilding re-runs the
 * write-up over the same one-voice transcript and returns the same blank, for ever, at a real cost
 * per tap. The website's own recovery code states it plainly: a heal "just re-runs the LLM on the
 * SAME one-sided transcript and stays blank".
 *
 * So the load-bearing tests here are the two negatives: that this case is NOT `engine-blank`, and
 * that `canRebuild` refuses it. The rest guard the sentences a rep reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canReRead,
  canRebuild,
  customerSideMissing,
  emptyReadReason,
  emptyReadWording,
  type EmptyReadReason,
} from '@/lib/after-pitch-empty';
import {
  RECOVERY_STATUSES,
  canAskAgain,
  isRecoveryStatus,
  recoveryRecoveredWords,
  recoveryWording,
} from '@/lib/transcript-recovery';
import type { AfterPitch } from '@/lib/after-pitch';

/** A debrief with nothing in it — the state every case below is a different reason for. */
function blank(scores: AfterPitch['scores']): AfterPitch {
  return {
    hasSignal: false,
    narrative: { hasSignal: false, strengths: [], growthAreas: [] },
    scores,
    focus: null,
  };
}

/** Exactly what the scoring engine produces for a call whose customer side carried no words. */
const CUSTOMER_MISSING: AfterPitch['scores'] = [
  { key: 'talk_ratio', label: 'Talk ratio', caveat: true },
  { key: 'question_rate', label: 'Questions', score: 3 },
];

// ---------------------------------------------------------------------------
// The two negatives — the actual defect

test('a one-sided call is NOT classified as a failed write-up', () => {
  const reason = emptyReadReason(blank(CUSTOMER_MISSING));
  assert.notEqual(reason, 'engine-blank', 'this is what offered a rebuild that cannot work');
  assert.equal(reason, 'customer-missing');
});

test('a one-sided call is never offered a rebuild', () => {
  const reason = emptyReadReason(blank(CUSTOMER_MISSING));
  assert.equal(canRebuild(reason), false, 'the transcript holds one voice; a rebuild returns the same blank');
  assert.equal(canReRead(reason), true, 'and the action that CAN work is offered instead');
});

test('no other reason is offered the re-read, which is a real charge on a real recording', () => {
  const others: EmptyReadReason[] = ['none', 'engine-blank', 'unexplained', 'retried-and-failed'];
  others.forEach((r) => {
    assert.equal(canReRead(r), false, `${r} would be a false diagnosis and a wasted charge`);
  });
});

// ---------------------------------------------------------------------------
// Detection — and what it must NOT catch

test('the caveat on talk_ratio is the signal, and it must be exactly true', () => {
  assert.equal(customerSideMissing(blank(CUSTOMER_MISSING)), true);
  assert.equal(customerSideMissing(blank([{ key: 'talk_ratio', caveat: false }])), false);
  assert.equal(customerSideMissing(blank([{ key: 'talk_ratio' }])), false, 'absent is not a caveat');
});

test('a caveat on some OTHER score is not this failure', () => {
  // Only talk_ratio's caveat means "the customer side carried zero words". Keying on any caveat at
  // all would misdiagnose a healthy call the moment another score gains one.
  assert.equal(customerSideMissing(blank([{ key: 'question_rate', caveat: true }])), false);
});

test('a healthy scored call, and a call with no scores, are both untouched', () => {
  assert.equal(customerSideMissing(blank([{ key: 'talk_ratio', score: 6 }])), false);
  assert.equal(emptyReadReason(blank([{ key: 'talk_ratio', score: 6 }])), 'engine-blank');
  assert.equal(emptyReadReason(blank([])), 'unexplained');
  assert.equal(customerSideMissing(null), false);
  assert.equal(customerSideMissing(blank(undefined)), false, 'a manager sees no scores at all');
});

test('a call that HAS a read is never diagnosed, whatever its scores say', () => {
  const withContent: AfterPitch = {
    hasSignal: true,
    narrative: { hasSignal: true, strengths: [{ point: 'p', example: 'e' }], growthAreas: [] },
    scores: CUSTOMER_MISSING,
    focus: null,
  };
  assert.equal(emptyReadReason(withContent), null, 'there is something to show; say nothing');
});

// ---------------------------------------------------------------------------
// Ordering — the diagnosis outranks the attempt

test('a failed retry does not hide WHY the call is empty', () => {
  // `justTried` says what happened; `customer-missing` says what is wrong. The second stays true
  // however many times it has been asked, and it is the half a rep can act on.
  const reason = emptyReadReason(blank(CUSTOMER_MISSING), true);
  assert.equal(reason, 'customer-missing');
});

test('but a retry on any other empty call still says the retry failed', () => {
  assert.equal(emptyReadReason(blank([{ key: 'talk_ratio', score: 6 }]), true), 'retried-and-failed');
  assert.equal(emptyReadReason(null, true), 'retried-and-failed');
});

// ---------------------------------------------------------------------------
// The words a rep reads

test('every reason has a title and a body, and none of them blames the rep', () => {
  const all: EmptyReadReason[] = [
    'none',
    'engine-blank',
    'unexplained',
    'customer-missing',
    'retried-and-failed',
  ];
  const titles = new Set<string>();
  all.forEach((r) => {
    const w = emptyReadWording(r);
    assert.ok(w.title.length > 0 && w.body.length > 0, `${r} has empty copy`);
    titles.add(w.title);
    // The sentence this whole area exists to remove: it told a rep their 683-word conversation was
    // not enough of a conversation.
    assert.doesNotMatch(w.body, /not enough of a conversation/i, `${r} brought the wrong sentence back`);
  });
  assert.equal(titles.size, all.length, 'two reasons sharing a title is two causes reading as one');
});

test('the one-sided message says the recording is safe and does not offer a rebuild', () => {
  const w = emptyReadWording('customer-missing');
  assert.match(w.body, /safe/i, 'the rep must know nothing was lost');
  assert.match(w.body, /read a second time|read again/i, 'and what can actually be done');
});

// ---------------------------------------------------------------------------
// The re-read outcomes

test('only a genuine outage is worth asking twice', () => {
  RECOVERY_STATUSES.forEach((s) => {
    assert.equal(canAskAgain(s), s === 'failed', `${s} is settled; a second identical button is a trap`);
  });
});

test('the two statuses that recovered the words say nothing, and the rest all say something', () => {
  RECOVERY_STATUSES.forEach((s) => {
    const w = recoveryWording(s);
    if (recoveryRecoveredWords(s)) {
      assert.equal(w, null, `${s} has a real read to show; a note about mechanics is noise over it`);
    } else {
      assert.ok(w && w.title && w.body, `${s} must never be a blank space where a reason should be`);
    }
  });
});

test('a recovered-but-unlabelled call does not read as a failure, because it is not one', () => {
  const w = recoveryWording('saved-unlabelled');
  assert.ok(w);
  assert.doesNotMatch(w.title, /fail|error|wrong|could not/i, 'the words are saved — say so');
});

test('an unknown status from a future server falls through to the honest failure', () => {
  assert.equal(isRecoveryStatus('recovered'), true);
  assert.equal(isRecoveryStatus('something-new'), false);
  assert.equal(isRecoveryStatus(undefined), false);
  assert.equal(isRecoveryStatus(null), false);
  assert.equal(isRecoveryStatus(7), false);
});

test('the statuses are exactly the eight the route can answer with', () => {
  // Pinned against the website's route, which returns these and only these. A status added there and
  // not here would render as a blank space on a rep's screen, so this list is the contract.
  assert.deepEqual([...RECOVERY_STATUSES].sort(), [
    'already-attempted',
    'canonical',
    'could-not-decide',
    'failed',
    'no-audio',
    'recovered',
    'saved-unlabelled',
    'still-one-sided',
  ]);
});
