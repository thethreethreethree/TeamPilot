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
  assert.equal(emptyReadReason(ap({ scores: [] })), 'thin');
  assert.equal(emptyReadReason(ap({})), 'thin');
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
