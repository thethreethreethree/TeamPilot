/**
 * Can this call be debriefed at all?
 *
 * THE HOUR THIS COST, on 4 September. The founder opened a test session from 18
 * August and the debrief card said:
 *
 *   "Not available right now — The debrief comes from the same server the
 *    website uses, and it does not accept the app's sign-in yet."
 *
 * Two claims, both false. The server accepts the app's sign-in (the Bearer
 * routes were shipped and are live), and the reason was nothing to do with
 * signing in. The session's row reads `audio_asset_url: null`,
 * `recording_saved: false`, and it has zero transcript segments. **There was
 * nothing to debrief.** A debrief is generated from a transcript, and that call
 * has never had one.
 *
 * The screen an inch above the card had the fact and stated it plainly — "No
 * recording was sent for this call, so there is no transcript" — while the card
 * beside it invented an authentication failure. That message sent the founder,
 * and then me, hunting a server bug for an hour: six hypotheses, a database
 * query and a production probe, to explain an error that was never happening.
 *
 * SO THE CARD IS TOLD WHAT THE SCREEN ALREADY KNOWS. This is the whole fix. The
 * card took a session id and nothing else, so the only question it could ask was
 * "did the request fail", and every no became a failure.
 *
 * FOUR ANSWERS, and only one of them is a problem:
 *
 *   ready               there is an attributed transcript; the debrief can be made.
 *   awaiting-voice      there are words, but nobody has said which voice is the
 *                       rep. Every coaching engine filters on `speaker === 'agent'`,
 *                       so this transcript reads as empty to all of them. Not a
 *                       wait and not a failure - it is one tap from ready, and the
 *                       picker above this card is where the tap goes.
 *   awaiting-transcript audio reached the server, the transcript has not landed, and not
 *                       enough time has passed to call that a failure. Nothing is wrong; it
 *                       is not ready YET.
 *   transcript-overdue  the same shape, waited out. Added 11 September, because "not ready
 *                       yet" was being said to calls where it was never going to be ready:
 *                       the website's sweep found nine sessions with saved audio and no
 *                       transcript, the oldest forty-seven days old. That card told the rep
 *                       to pull down to check again. See `transcript-wait.ts` for where the
 *                       boundary between the two comes from.
 *   no-recording        no audio was ever sent. Not an error, not a wait, and
 *                       not something a retry will change.
 *
 * `awaiting-voice` was added on 10 September, the day recovery started saving a
 * dropped call's words as `unknown` when it could not tell the voices apart. Before
 * it, such a call had a transcript, so this said `ready`, and the card then offered
 * a debrief that would come back blank - the same shape as the invented
 * authentication error above: a card asserting something the screen already knew
 * was untrue.
 *
 * PURE, so the difference between "broken", "not yet" and "never" is a tested
 * rule rather than a guess made inside a catch block.
 */

export type DebriefAvailability =
  | 'ready'
  | 'awaiting-voice'
  | 'awaiting-transcript'
  | 'transcript-overdue'
  | 'no-recording';

export function debriefAvailability(
  /** Whether the server holds audio for this call. */
  hasAudio: boolean,
  /** How many transcript segments exist. */
  segmentCount: number,
  /**
   * How many of those segments nobody has attributed.
   *
   * Optional and defaulted to 0, so every existing caller behaves exactly as before.
   * Omitting it means "not asked", which is treated as "none" rather than as a reason
   * to withhold a debrief that may be perfectly ready.
   */
  unattributedCount = 0,
  /**
   * Has the wait for the transcript gone past what transcription can honestly take?
   *
   * PASSED IN RATHER THAN COMPUTED, because deciding it needs the current time and a rule that
   * lives elsewhere - and a pure function that reads the clock is a pure function that cannot be
   * tested. `transcriptOverdue` in `transcript-wait.ts` is what answers it.
   *
   * Defaulted to false so every existing caller keeps its exact behaviour: not asked means not
   * overdue, which leaves the softer sentence rather than accusing a call of failing.
   */
  overdue = false,
): DebriefAvailability {
  if (Number.isFinite(segmentCount) && segmentCount > 0) {
    // ALL of them, not any. A transcript with one real turn already reads to the
    // engines, and telling a rep to answer a question the server would refuse
    // (it 409s an attributed transcript) is worse than saying nothing.
    if (
      Number.isFinite(unattributedCount) &&
      unattributedCount > 0 &&
      unattributedCount >= segmentCount
    ) {
      return 'awaiting-voice';
    }
    return 'ready';
  }
  if (!hasAudio) return 'no-recording';
  return overdue ? 'transcript-overdue' : 'awaiting-transcript';
}

/**
 * What the card says when there is no debrief to offer.
 *
 * NEITHER SENTENCE IS AN ERROR, and neither offers a retry, because there is
 * nothing to retry. Both say what IS still true of the call, so a rep does not
 * read "no debrief" as "this call did not count".
 */
export function unavailableTitle(state: Exclude<DebriefAvailability, 'ready'>): string {
  if (state === 'no-recording') return 'No recording for this call';
  if (state === 'awaiting-voice') return 'Waiting on one answer';
  if (state === 'transcript-overdue') return 'The words never came back from this call';
  return 'Waiting for the transcript';
}

export function unavailableBody(state: Exclude<DebriefAvailability, 'ready'>): string {
  if (state === 'no-recording') {
    return 'The debrief is written from what was said, and no recording was sent for this call — so there is nothing to read it from. Setting how it ended still counts this call in your numbers.';
  }
  if (state === 'awaiting-voice') {
    return 'We have what was said on this call, but only one voice came through and we could not tell whose it is. Say which above and the debrief is written from it — the words are already saved either way.';
  }
  if (state === 'transcript-overdue') {
    // NOT "still being turned into a transcript", which is what this said for as long as the
    // waiting lasted - and for the calls that reach here, that was up to forty-seven days.
    return 'Your recording is safe on the server, but it was never turned into words, and enough time has passed that it is not still coming. Nothing you did caused it. It can be read from the recording now, which usually recovers the whole conversation.';
  }
  return 'The recording reached the server and is still being turned into a transcript. The debrief can be made as soon as that arrives — pull down to check again.';
}

/**
 * Would re-reading the recording help from this state?
 *
 * ONLY when the wait is over. The recovery route was rewritten on 10 September precisely for this
 * case - its own note says the old precondition made "a call with saved audio and NO transcript"
 * answer not-applicable and stop, which is how nine of them sat untouched, and that the replacement
 * "covers blank, unknown-only, customer-only and the original customer-missing gap alike".
 *
 * NOT while it is merely `awaiting-transcript`: spending a speech-to-text charge on work that is
 * still in flight is the mistake that costs money rather than the one that costs a sentence.
 */
export function canReReadFrom(state: DebriefAvailability): boolean {
  return state === 'transcript-overdue';
}
