/**
 * WHY a debrief is empty — because the two reasons need opposite sentences, and the app
 * used to give the same one to both.
 *
 * An empty debrief always said: "There was not enough of a conversation here for the coach
 * to say anything useful. That is a fact about the call, not about you." Kind, and for most
 * of these calls FALSE. Measured on production 10 September 2026: of the 168 sessions the
 * coaching engines can read, 56 ran and produced nothing — and they are systematically the
 * LONGER calls, median 683 words against 362. The app was telling a rep their 683-word
 * conversation was not enough of a conversation.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyReadReason } from '@/lib/after-pitch-empty';
import type { AfterPitch } from '@/lib/after-pitch';

const ap = (over: Partial<AfterPitch>): AfterPitch =>
  ({
    hasSignal: true,
    narrative: { hasSignal: false, strengths: [], growthAreas: [] },
    ...over,
  }) as AfterPitch;

test('THE WRONG SENTENCE: a SCORED call with no write-up is not a thin call', () => {
  // Scores mean the call was substantial enough to measure. A blank write-up on a scored
  // call is the write-up failing — telling the rep their call was too thin is false, and
  // it is the sentence that landed on 56 of this company's sessions.
  const r = emptyReadReason(ap({ scores: [{ label: 'Opening', score: 72 }] }));
  assert.equal(r, 'engine-blank');
});

test('a call with NO scores and no write-up is genuinely thin — the sentence is true there', () => {
  assert.equal(emptyReadReason(ap({ scores: [] })), 'unexplained');
  assert.equal(emptyReadReason(ap({})), 'unexplained');
});

test('nothing written yet is neither — it is an offer to write it', () => {
  assert.equal(emptyReadReason(null), 'none');
});

test('a debrief with real content returns null — there is nothing to explain', () => {
  const withStrength = ap({
    narrative: {
      hasSignal: true,
      strengths: [{ point: 'Opened well' } as never],
      growthAreas: [],
    },
    scores: [{ label: 'Opening', score: 72 }],
  });
  assert.equal(emptyReadReason(withStrength), null);
});

test('growth areas alone are content — a call can have nothing praised and still be read', () => {
  const growthOnly = ap({
    narrative: {
      hasSignal: true,
      strengths: [],
      growthAreas: [{ opportunity: 'Ask before pitching' } as never],
    },
  });
  assert.equal(emptyReadReason(growthOnly), null);
});

test('the scored-but-blank case is decided by SCORES, not by hasSignal', () => {
  // hasSignal false on both the summary and the narrative is what hasContent keys on. The
  // discriminator has to survive that, or the scored case falls back to "thin" — which is
  // exactly the bug.
  const r = emptyReadReason(
    ap({
      hasSignal: false,
      narrative: { hasSignal: false, strengths: [], growthAreas: [] },
      scores: [{ label: 'Discovery', score: 40 }],
    }),
  );
  assert.equal(r, 'engine-blank');
});

/**
 * The sentence, again, one branch over (2026-09-11).
 *
 * This file was created to remove "there was not enough of a conversation here for the coach to say
 * anything useful" from the ENGINE-BLANK case. It stayed on the other branch, where scores are absent —
 * on the reasoning that a missing score means a thin call.
 *
 * That reasoning holds in one direction only. Measured in the founder's own company: 12 sessions have
 * 100+ words FROM THE REP and no scores at all, the largest 757 words. And no threshold would rescue it —
 * across every company the smallest call that DID get scored has ONE rep word, and the largest that did
 * NOT has 1,153. Length is simply not the discriminator, so nothing in the app can tell the two apart.
 *
 * The name says what is observed; these pin that it claims no cause.
 */
test('the no-scores case is named for what is observed, not for a cause nothing recorded', () => {
  assert.equal(emptyReadReason(ap({ scores: [] })), 'unexplained');
  assert.notEqual(emptyReadReason(ap({ scores: [] })), 'thin', 'thin was a claim, and it was wrong');
});

test('a scored call with a blank write-up is still the write-up failing — that half always held', () => {
  assert.equal(emptyReadReason(ap({ scores: [{ label: 'tone', value: 70 }] as never })), 'engine-blank');
});
