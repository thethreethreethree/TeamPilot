/**
 * Has this call come back from the coach yet?
 *
 * THE QUESTION A REP ASKS EVERY DAY, and the list could not answer it. A rep who
 * recorded four calls this morning opens Sessions and sees four rows that look
 * identical whether the coaching has arrived or not — the only way to find out
 * was to tap each one. The DETAIL screen has always handled this properly, with
 * polling and an honest "still waiting"; the list simply never carried the fact.
 *
 * FOUR STATES, NOT TWO, and the fourth is the one that matters most.
 *
 *   no-audio   nothing was recorded on this session, so there is nothing to
 *              analyse and nothing to say.
 *   analysing  audio reached the server and no transcript exists yet.
 *   analysed   the transcript is there.
 *   unknown    WE COULD NOT FIND OUT. The count came back missing, because the
 *              embedded query failed and the caller fell back to a plain read.
 *
 * `unknown` renders NOTHING, and that is the whole reason it exists as its own
 * state rather than collapsing into `analysing`. Telling a rep their call is
 * "still being analysed" when the truth is that the app could not check is the
 * same defect as showing a zero for a figure nobody could read — it is a
 * confident answer to a question that was never answered. The app's rule is that
 * an unknown is never dressed as a fact, and this is that rule in a chip.
 *
 * PURE, so the rule is tested rather than living inside a list row.
 */

export type AnalysisState = 'no-audio' | 'analysing' | 'stalled' | 'analysed' | 'unknown';

/**
 * How long a transcript may take before "being analysed" stops being a claim we
 * can stand behind.
 *
 * FIVE MINUTES, TAKEN FROM THE DETAIL SCREEN rather than invented here. That
 * screen polls twenty times at fifteen seconds and then stops, on the reasoning
 * that "a call of the length this app records transcribes well inside that; past
 * it the honest conclusion is not 'keep waiting' but 'something is wrong'". Two
 * different answers to the same question on two screens is how a rep ends up
 * being told a call is in progress on one and finished on the other.
 */
export const ANALYSIS_WINDOW_MS = 5 * 60 * 1000;

export function analysisState(
  /** Whether the server holds audio for this session. */
  hasAudio: boolean,
  /**
   * How many transcript segments exist, or NULL when the count could not be
   * read. Null is not zero: zero means "checked, none there".
   */
  segmentCount: number | null | undefined,
  /**
   * When the server first knew about this session, and now — both optional.
   *
   * Without them the answer is the honest, cautious one: anything unfinished is
   * simply "analysing". With them, a session that has been waiting longer than
   * the window is reported as STALLED instead, because past that point "being
   * analysed" is a claim about work in progress that nobody has checked.
   */
  createdAtIso?: string | null,
  now: number = Date.now(),
): AnalysisState {
  if (!hasAudio) return 'no-audio';
  if (typeof segmentCount !== 'number' || !Number.isFinite(segmentCount)) return 'unknown';
  if (segmentCount > 0) return 'analysed';

  const started = createdAtIso ? Date.parse(createdAtIso) : Number.NaN;
  // An unreadable or future timestamp falls back to 'analysing' — the gentler of
  // the two, because a clock that cannot be trusted is no reason to tell a rep
  // something may be wrong with their call.
  if (!Number.isFinite(started) || started > now) return 'analysing';
  return now - started > ANALYSIS_WINDOW_MS ? 'stalled' : 'analysing';
}

/**
 * What the row says, or null for nothing at all.
 *
 * ONLY `analysing` GETS A CHIP. A finished call needs no badge — the transcript
 * and the score are the badge, one tap away, and a row wearing "Analysed" on
 * every line would be noise on the screen a rep scrolls most. The chip exists to
 * answer "why is there nothing in this one yet", which is only a question while
 * the answer is "not yet".
 */
export function analysisChip(state: AnalysisState): string | null {
  if (state === 'analysing') return 'Being analysed';
  /**
   * NOT "failed", and not "something went wrong".
   *
   * Nobody has checked. The transcript may still arrive — the pipeline can be
   * backed up, and a call recorded offline is only uploaded when signal returns,
   * so a session can be hours old and minutes into its analysis. What is
   * certainly true is that there is no transcript, so that is what it says. The
   * detail screen takes the same care: it reports that it stopped looking, never
   * that the call is lost.
   */
  if (state === 'stalled') return 'No transcript yet';
  return null;
}

/**
 * The same fact for a screen reader, appended to the row's spoken name.
 *
 * Said as a sentence rather than a word, because a screen-reader user hears the
 * row as one continuous name and "being analysed" dropped between a time and a
 * duration reads as a fragment.
 */
export function analysisSpoken(state: AnalysisState): string | null {
  if (state === 'analysing') return 'still being analysed';
  if (state === 'stalled') return 'no transcript yet';
  return null;
}

/**
 * What the session screen says when there is still no transcript.
 *
 * TWO SITUATIONS THAT DESERVE DIFFERENT SENTENCES, and the screen used to have
 * only one. Opening a call recorded three weeks ago with no transcript, the app
 * polled twenty times over five minutes, said nothing at all in the meantime,
 * and then reported "Still no transcript after five minutes" — which was true of
 * the five minutes it had just spent and wildly untrue of the call.
 *
 * A rep in that position wants to know their recording is safe, and they want to
 * know it on arrival rather than after twenty pointless requests on their
 * battery.
 */
export type WaitReason =
  /** We watched for the full window in this sitting and nothing came. */
  | 'waited'
  /** It was already long past the window when the screen opened. */
  | 'arrived-stale';

export function transcriptWaitTitle(reason: WaitReason): string {
  return reason === 'waited'
    ? 'Still no transcript after five minutes'
    : 'This call has no transcript';
}

export function transcriptWaitBody(reason: WaitReason): string {
  const safe = 'The recording is safe on the server either way. Pull down to look again.';
  return reason === 'waited'
    ? `The app has stopped checking on its own so it is not sitting on your battery. ${safe}`
    : // Says WHY it is not checking, because a screen that simply shows nothing
      // happening is indistinguishable from a screen that is broken.
      `It was recorded long enough ago that the app is not going to keep checking on its own. ${safe}`;
}
