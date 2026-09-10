/**
 * "Your read" — the deep, whole-conversation teaching evaluation of a recorded call.
 *
 * WHY THIS EXISTS AT ALL. The app has never shown it. The web has had it since the coach was built, and
 * the phone showed the transcript, the debrief and the scores but never the one artifact that reads the
 * WHOLE conversation and says what the rep did well, what to work on, and the strategy they used without
 * noticing. A rep on the doors has the phone; the read lived where they were not.
 *
 * IT BECAME URGENT WHEN THE SESSIONS LIST STARTED NAMING ITS ABSENCE. On 2026-09-10 the coach began
 * recording WHICH kind of empty it hit, and the list now shows "Read didn't finish" on a call where the
 * coach crashed or came back blank. A chip that names a problem and offers nothing to do about it is
 * worse than no chip - it tells a rep something is broken and leaves them holding it. This module is the
 * other half of that chip.
 *
 * THE DECISIONS LIVE HERE, NOT IN THE COMPONENT, so "what does a rep see when there is no read" is a rule
 * with tests rather than a chain of conditions assembled inside a card. The same split the debrief card
 * uses (`after-pitch-empty.ts`), for the same reason: the wording IS the product on an empty state.
 */

/** One thing the rep did well, with the moment it happened and why it worked. */
export type ReadStrength = { point: string; example: string; why: string };
/** One thing to work on, with the concrete next step. Never a verdict without a step. */
export type ReadGrowth = { opportunity: string; nextStep: string; why: string };
/** The play the rep ran, named back to them. */
export type ReadStrategy = { name: string; example: string; why: string };

export type SessionRead = {
  hasSignal: boolean;
  strengths: ReadStrength[];
  growthAreas: ReadGrowth[];
  standoutStrategy: ReadStrategy | null;
  overall?: string;
};

/**
 * Why there is no read to show.
 *
 *   'never-made'   nothing has been generated for this call yet. Offer to make one.
 *   'no-speech'    the transcript holds no words of the rep. Nothing to read, and no button:
 *                  spending an LLM call on it would produce the same empty answer.
 *   'unfinished'   the coach ran and produced nothing. This is the retryable one.
 */
export type NoReadReason = 'never-made' | 'no-speech' | 'unfinished';

/** A transcript line, reduced to what the decision needs. */
export type ReadSegment = { speaker: string; text: string };

/** Sound-event annotations - speech-to-text returns these instead of an empty string. */
const SOUND_EVENT = /\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g;

/**
 * Does this call have anything a coach could read?
 *
 * Two conditions, and the second is the one the rest of this build is about: the rep has to have SAID
 * something. A transcript of `[clicking]` is not a quiet call, it is a recording of a sound - measured
 * 2026-09-10, 24 of 45 graded door pitches in one company were exactly that.
 */
export function hasReadableSpeech(segments: ReadSegment[]): boolean {
  return segments.some(
    (s) =>
      s.speaker === 'agent' &&
      s.text
        .replace(SOUND_EVENT, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim().length > 0,
  );
}

/**
 * What to say, and whether to offer a button.
 *
 * `attemptFailed` comes from the sessions list's own verdict: the coach ran and came back blank,
 * unreadable, or threw. It is the difference between "nobody has asked for this yet" and "we asked and
 * it broke", which are the same blank screen and completely different sentences.
 */
export function noReadReason(args: {
  read: SessionRead | null;
  segments: ReadSegment[];
  attemptFailed?: boolean;
}): NoReadReason | null {
  if (args.read && args.read.hasSignal) return null;
  if (!hasReadableSpeech(args.segments)) return 'no-speech';
  return args.attemptFailed ? 'unfinished' : 'never-made';
}

/** Whether a rep can do anything about it. No button on a call with nothing to read - that is honest. */
export function canRetryRead(reason: NoReadReason | null): boolean {
  return reason === 'never-made' || reason === 'unfinished';
}

/**
 * The words.
 *
 * `no-speech` deliberately says the recording caught no speech rather than "not enough of a
 * conversation" - the second reads as a judgement of the rep, and this project has already shipped that
 * mistake once and had to take it back.
 */
export function noReadWording(reason: NoReadReason): { title: string; body: string; action?: string } {
  if (reason === 'never-made') {
    return {
      title: 'No read yet',
      body: 'Nothing has been written for this call yet. Making one reads the whole conversation from start to finish, so it takes a moment.',
      action: 'Read this call',
    };
  }
  if (reason === 'unfinished') {
    return {
      title: 'The read did not finish',
      body: 'The coach started on this call and stopped before it produced anything. Your recording is fine — this is the write-up failing, and trying again usually fixes it.',
      action: 'Try again',
    };
  }
  return {
    title: 'Nothing to read on this one',
    body: 'This recording did not catch you speaking, so there is no conversation for the coach to read. Nothing is wrong with your phone or your account.',
  };
}

/** Count what a read actually carries, so a card never claims a section it cannot fill. */
export function readSections(read: SessionRead): {
  strengths: number;
  growth: number;
  hasStrategy: boolean;
  hasOverall: boolean;
} {
  return {
    strengths: read.strengths.length,
    growth: read.growthAreas.length,
    hasStrategy: read.standoutStrategy !== null && read.standoutStrategy.name.trim().length > 0,
    hasOverall: typeof read.overall === 'string' && read.overall.trim().length > 0,
  };
}
