import type { PendingAttribution, PendingSegment } from './attribution-store';
import type { CoachingSession, TranscriptSegment } from '@/types/backend';

/**
 * relabel-unknown — asking whose voice it was, for a call this phone never uploaded.
 *
 * THE GAP THIS CLOSES. The picker on the session screen is fed by
 * `readPendingAttribution`, which reads a store on THIS device, written when THIS phone
 * uploaded the recording. That is the right source for a call the rep just finished. It is
 * the wrong source — it is empty — for a call the SERVER recovered: the hourly sweep
 * re-reads audio that was dropped weeks ago, saves the words as `unknown`, and there is no
 * local record of it anywhere. Without this the rep sees a transcript with no speakers,
 * no question, and no way to answer one.
 *
 * So the question is rebuilt from the transcript itself. A server-saved `unknown`
 * transcript is exactly the case where the system could not separate two voices, which
 * means there is only ONE voice to ask about — and the question collapses to a binary the
 * rep can always answer: is this you, or the customer? No diarized cluster ids are needed
 * for that, which is fortunate, because the stored transcript has been flattened and no
 * longer carries any.
 *
 * THE TIMING IS THE PART THAT IS EASY TO LOSE, and losing it would be a silent downgrade.
 * `/label-transcript` rebuilds `spoken_at` from the `startSeconds` in the payload it is
 * given; a payload without them stamps every segment null. The recovery that saved these
 * words placed them on the call's own clock from the transcription's word timestamps —
 * so answering the question with a naive payload would DESTROY the timing that made the
 * pace skill work, in the very act of making the transcript coachable. Here the offsets
 * are read back out of `spoken_at` against the session start, so the answer keeps them.
 *
 * An unknown is never a zero: a segment with no `spoken_at` carries no offset at all
 * rather than being stamped to the start of the call.
 */

/**
 * The synthetic cluster id standing for "the one voice on this recording".
 *
 * `/label-transcript` labels a segment `agent` when its speakerId equals the id sent and
 * `customer` otherwise. So sending THIS id marks the whole call as the rep speaking, and
 * sending anything else (the picker's NOT_THE_REP) marks it all as the customer. Both are
 * real answers and both save the transcript; neither needs a server change.
 */
export const SOLO_SPEAKER_ID = 'solo';

/**
 * Is this a transcript that exists but has never been attributed?
 *
 * Every segment unknown, and at least one segment. An empty transcript is NOT this case —
 * there is nothing yet to ask about, and the screen has its own waiting state for it. A
 * transcript with even one attributed turn is not this case either: it has an answer.
 */
export function isUnlabelled(segments: Pick<TranscriptSegment, 'speaker'>[]): boolean {
  if (segments.length === 0) return false;
  return segments.every((s) => s.speaker === 'unknown');
}

/**
 * Seconds from the start of the call to when this line was spoken.
 *
 * Returns undefined — never 0 — whenever the answer is not known: no timestamp, an
 * unparseable one, or a negative offset, which is a corrupt value rather than "just
 * before the start". Stamping an unknown as zero would place every untimed line at the
 * opening of the call and quietly invent a pace reading.
 */
export function startSecondsFor(
  startedAt: string | null | undefined,
  spokenAt: string | null | undefined,
): number | undefined {
  if (!startedAt || !spokenAt) return undefined;
  const base = Date.parse(startedAt);
  const at = Date.parse(spokenAt);
  if (!Number.isFinite(base) || !Number.isFinite(at)) return undefined;
  const seconds = (at - base) / 1000;
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds;
}

/**
 * Rebuild the "whose voice is this?" question from a stored unlabelled transcript.
 *
 * Returns null when there is nothing to ask — so the caller can use it as the condition
 * itself rather than testing twice and drifting.
 */
export function attributionFromTranscript(
  session: Pick<CoachingSession, 'started_at'> | null | undefined,
  segments: TranscriptSegment[],
): Pick<PendingAttribution, 'speakers' | 'segments'> | null {
  if (!isUnlabelled(segments)) return null;

  const payload: PendingSegment[] = segments.map((s) => {
    const startSeconds = startSecondsFor(session?.started_at, s.spoken_at);
    const seg: PendingSegment = { speakerId: SOLO_SPEAKER_ID, text: s.text, seq: s.seq };
    if (startSeconds !== undefined) seg.startSeconds = startSeconds;
    return seg;
  });

  // The sample is what the rep actually reads to decide, so it must be a line with words
  // in it — the first segment can easily be an empty or whitespace-only turn.
  const sample = segments.find((s) => s.text.trim().length > 0)?.text.trim() ?? '';

  return { speakers: [{ speakerId: SOLO_SPEAKER_ID, sample }], segments: payload };
}
