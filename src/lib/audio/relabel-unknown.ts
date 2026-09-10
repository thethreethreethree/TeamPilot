import { hasSpeech } from './speech-presence';
import type { PendingSpeaker } from './attribution-store';
import type { TranscriptSegment } from '@/types/backend';

/**
 * relabel-unknown — asking whose voice it was, for a call this phone never uploaded.
 *
 * THE GAP THIS CLOSES. The picker on the session screen is fed by
 * `readPendingAttribution`, which reads a store on THIS device, written when THIS phone
 * uploaded the recording. That is the right source for a call the rep just finished. It is
 * the wrong source — it is empty — for a call the SERVER recovered: the hourly sweep
 * re-reads audio that was dropped weeks ago, saves the words as `unknown`, and there is no
 * local record of it anywhere. Without this the rep sees a transcript with no speakers, no
 * question, and no way to answer one.
 *
 * So the question is rebuilt from the transcript itself. A server-saved `unknown` transcript
 * is exactly the case where the system could not separate two voices, which means there is
 * only ONE voice to ask about — and the question collapses to a binary the rep can always
 * answer: is this you, or the customer?
 *
 * WHAT THIS DELIBERATELY NO LONGER DOES, because it is worth knowing why the code is small.
 * The first version rebuilt the whole segment payload and reconstructed each line's offset
 * from `spoken_at`, because the only way to answer was `/label-transcript`, which REWRITES
 * the transcript from what the client sends — so a payload without offsets would have
 * silently deleted the timing in the very act of making the call coachable, and a long call
 * could exceed its segment cap.
 *
 * `/attribute-unlabelled` replaced that: the server relabels the rows it already holds and
 * never touches `spoken_at`, so the timing cannot be lost by a client that forgets it, and
 * there is no payload to cap. The reconstruction was deleted rather than left sitting
 * unused — an unused code path is a claim that something needs doing when it does not.
 */

/** The `source` a human answer is written with — the server writes exactly this string. */
const MANUAL_SOURCE = 'manual';

/**
 * Is this a transcript the rep can still answer for?
 *
 * It used to mean "every segment is unknown", which matched the server's old precondition. Both were
 * testing the LABEL when the rule is really about the AUTHOR (server 2fb2b5ae): a rep may correct a
 * machine's guess and may never overwrite a person's answer. Measured on production 2026-09-10, of 2,414
 * stored segments not one carries `source: 'manual'` — so a transcript the diarizer labelled entirely
 * `customer` was a rep's own pitch they could read, watch score nothing, and never fix.
 *
 * THREE CONDITIONS, and the third is the one that keeps this quiet:
 *   - ONE voice throughout. Two voices is a captured two-sided call; re-attributing it wholesale would be
 *     a deletion, and the server refuses it anyway.
 *   - NOBODY has answered. One `manual` segment and the question is closed, including to a second
 *     opinion from the same rep.
 *   - The current label is NOT `agent`. This is a UI judgement, not a server rule: an agent-labelled
 *     transcript already produces coaching, so asking "was that you?" on it would put a question on 43 of
 *     the 176 sessions that are working fine. The question is offered exactly where the rep is currently
 *     getting NOTHING — an unknown or customer-only transcript scores zero, because every engine filters
 *     on `speaker === 'agent'`.
 */
export function isAnswerable(segments: Pick<TranscriptSegment, 'speaker' | 'source'>[]): boolean {
  if (segments.length === 0) return false;
  if (segments.some((s) => s.source === MANUAL_SOURCE)) return false;
  const speakers = new Set(segments.map((s) => s.speaker));
  if (speakers.size !== 1) return false;
  return [...speakers][0] !== 'agent';
}

/**
 * Rebuild the "whose voice is this?" question from a stored transcript nobody has answered for.
 *
 * Returns null when there is nothing to ask — so the caller can use it as the condition
 * itself rather than testing twice and drifting.
 */
export function speakersFromTranscript(segments: TranscriptSegment[]): PendingSpeaker[] | null {
  if (!isAnswerable(segments)) return null;
  // The sample is what the rep actually reads to decide, so it must be a line with WORDS in it.
  // "Words" is not "non-empty" (2026-09-10): a call that captured no speech comes back from STT as
  // `[clicking]` or `[outro jingle]`, never as "". Those pass .trim(), so the old check would put a
  // SOUND in front of the rep as though it were something they had said.
  //
  // When nothing on the recording has speech the sample is empty and the question is STILL asked, for
  // the reason the blank-lines case was decided on: there is a real unattributed transcript here, and
  // an invented sample would put words in the rep's mouth. Silently dropping the question would leave
  // exactly the state the top of this file exists to prevent — a transcript with no speakers and no
  // way to answer.
  const sample = segments.find((s) => hasSpeech(s.text))?.text.trim() ?? '';
  return [{ speakerId: SOLO_SPEAKER_ID, sample }];
}

/**
 * The id standing for "the one voice on this recording".
 *
 * It never reaches the server — `/attribute-unlabelled` takes a boolean — but the picker is
 * built around speaker ids, and giving this one a name keeps the component unchanged for
 * both sources of the question.
 */
export const SOLO_SPEAKER_ID = 'solo';
