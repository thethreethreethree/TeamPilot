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
 * THREE ANSWERS, and only one of them is a problem:
 *
 *   ready               there is a transcript; the debrief can be made.
 *   awaiting-transcript audio reached the server, the transcript has not landed.
 *                       Nothing is wrong; it is not ready YET.
 *   no-recording        no audio was ever sent. Not an error, not a wait, and
 *                       not something a retry will change.
 *
 * PURE, so the difference between "broken", "not yet" and "never" is a tested
 * rule rather than a guess made inside a catch block.
 */

export type DebriefAvailability = 'ready' | 'awaiting-transcript' | 'no-recording';

export function debriefAvailability(
  /** Whether the server holds audio for this call. */
  hasAudio: boolean,
  /** How many transcript segments exist. */
  segmentCount: number,
): DebriefAvailability {
  if (Number.isFinite(segmentCount) && segmentCount > 0) return 'ready';
  return hasAudio ? 'awaiting-transcript' : 'no-recording';
}

/**
 * What the card says when there is no debrief to offer.
 *
 * NEITHER SENTENCE IS AN ERROR, and neither offers a retry, because there is
 * nothing to retry. Both say what IS still true of the call, so a rep does not
 * read "no debrief" as "this call did not count".
 */
export function unavailableTitle(state: Exclude<DebriefAvailability, 'ready'>): string {
  return state === 'no-recording' ? 'No recording for this call' : 'Waiting for the transcript';
}

export function unavailableBody(state: Exclude<DebriefAvailability, 'ready'>): string {
  return state === 'no-recording'
    ? 'The debrief is written from what was said, and no recording was sent for this call — so there is nothing to read it from. Setting how it ended still counts this call in your numbers.'
    : 'The recording reached the server and is still being turned into a transcript. The debrief can be made as soon as that arrives — pull down to check again.';
}
