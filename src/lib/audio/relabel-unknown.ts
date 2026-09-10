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

/**
 * Is this a transcript that exists but has never been attributed?
 *
 * Every segment unknown, and at least one segment. An empty transcript is NOT this case —
 * there is nothing yet to ask about, and the screen has its own waiting state for it. A
 * transcript with even one attributed turn is not this case either: it has an answer, and
 * the server would refuse to change it.
 */
export function isUnlabelled(segments: Pick<TranscriptSegment, 'speaker'>[]): boolean {
  if (segments.length === 0) return false;
  return segments.every((s) => s.speaker === 'unknown');
}

/**
 * Rebuild the "whose voice is this?" question from a stored unlabelled transcript.
 *
 * Returns null when there is nothing to ask — so the caller can use it as the condition
 * itself rather than testing twice and drifting.
 */
export function speakersFromTranscript(segments: TranscriptSegment[]): PendingSpeaker[] | null {
  if (!isUnlabelled(segments)) return null;
  // The sample is what the rep actually reads to decide, so it must be a line with words in
  // it — the first segment can easily be an empty or whitespace-only turn.
  const sample = segments.find((s) => s.text.trim().length > 0)?.text.trim() ?? '';
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
