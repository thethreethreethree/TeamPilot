/**
 * One time-ordered account of a session: what was said, with the coach's cues
 * placed where they actually landed.
 *
 * WHY THIS EXISTS. The transcript and the cues were rendered as two separate
 * lists, which loses the only thing that makes them worth reading together —
 * *when* the coach spoke. A rep reviewing a pitch wants "they raised price →
 * the coach offered this → here is what I actually said", not a wall of speech
 * followed by a wall of advice. The data already carries the timestamps
 * (`spoken_at` on a segment, `delivered_at` on a cue); nothing new is fetched.
 *
 * HONESTY ABOUT MISSING TIMESTAMPS. Both columns are nullable. A cue with no
 * `delivered_at` cannot be placed in the conversation, and guessing a position
 * for it would be inventing a fact about what the rep heard and when. Those are
 * returned separately, so the screen can show them as "not placed in time"
 * rather than silently dropping them or quietly implying an order that was never
 * recorded.
 *
 * Segments are ordered by `seq`, which the server assigns and is authoritative;
 * `spoken_at` is only used to position cues BETWEEN them.
 */
import type { CoachingCue, TranscriptSegment } from '@/types/backend';

export type TimelineEntry =
  | { kind: 'segment'; segment: TranscriptSegment }
  | { kind: 'cue'; cue: CoachingCue };

export type Timeline = {
  /** Speech and cues in the order they happened. */
  entries: TimelineEntry[];
  /** Cues the server never timestamped, so they cannot honestly be placed. */
  unplacedCues: CoachingCue[];
};

const time = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

export function buildTimeline(
  segments: TranscriptSegment[],
  cues: CoachingCue[],
): Timeline {
  // seq is the server's own ordering and outranks any clock.
  const ordered = [...segments].sort((a, b) => a.seq - b.seq);

  const placeable: { at: number; cue: CoachingCue }[] = [];
  const unplacedCues: CoachingCue[] = [];
  for (const cue of cues) {
    const at = time(cue.delivered_at);
    if (at === null) unplacedCues.push(cue);
    else placeable.push({ at, cue });
  }
  placeable.sort((a, b) => a.at - b.at);

  // With no usable segment clock there is nothing to interleave against, so the
  // conversation is shown whole and the cues follow it — the previous behaviour,
  // reached honestly rather than by accident.
  const anySegmentClock = ordered.some((s) => time(s.spoken_at) !== null);
  if (!anySegmentClock) {
    return {
      entries: [
        ...ordered.map((segment) => ({ kind: 'segment' as const, segment })),
        ...placeable.map(({ cue }) => ({ kind: 'cue' as const, cue })),
      ],
      unplacedCues,
    };
  }

  const entries: TimelineEntry[] = [];
  let next = 0;

  for (const segment of ordered) {
    const at = time(segment.spoken_at);
    // A cue belongs before this line if it was delivered before this line was
    // spoken. Segments with no clock of their own simply do not trigger a flush;
    // the cue waits for the next segment that has one.
    if (at !== null) {
      while (next < placeable.length && placeable[next].at <= at) {
        entries.push({ kind: 'cue', cue: placeable[next].cue });
        next++;
      }
    }
    entries.push({ kind: 'segment', segment });
  }

  // Anything delivered after the last spoken line still happened, and belongs at
  // the end rather than being discarded.
  for (; next < placeable.length; next++) {
    entries.push({ kind: 'cue', cue: placeable[next].cue });
  }

  return { entries, unplacedCues };
}
