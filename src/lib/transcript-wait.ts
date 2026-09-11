/**
 * How long "still being turned into a transcript" is allowed to be true.
 *
 * THE SENTENCE THIS EXISTS TO STOP. A call whose audio reached the server but whose transcript
 * never landed showed the rep:
 *
 *   "The recording reached the server and is still being turned into a transcript. The debrief
 *    can be made as soon as that arrives — pull down to check again."
 *
 * Every clause of that is a promise of imminence, and for the calls that actually hit it the
 * promise was false. The website's recovery sweep records what the real population looked like on
 * 10 September 2026: nine sessions with saved audio and no transcript at all, one of them the
 * founder's own test from that morning, and **the oldest from 25 July** — forty-seven days. A rep
 * pulling down to check again would have pulled for seven weeks.
 *
 * It is the same defect this codebase keeps finding in different clothes: an absence handed a
 * confident, wrong explanation. "Not yet" and "never" need opposite sentences, and the app had one.
 *
 * WHERE THE THRESHOLD COMES FROM, because a number invented here would be the same failure. The
 * recovery route and the recovery cron both declare `maxDuration = 300` — five minutes is the
 * platform's own hard ceiling for a batch diarization of a full recording, and nothing in this
 * pipeline is permitted to run longer. Fifteen minutes is three times that ceiling: comfortably
 * past any honest slow path, and nowhere near seven weeks.
 *
 * PURE, so the boundary between "wait" and "this failed" is a tested rule rather than a guess made
 * inside a render.
 */

/**
 * Three times the platform's own 300s ceiling for turning a recording into words.
 *
 * Deliberately generous. Being early with "this failed" on a call that was merely slow would send a
 * rep to spend a speech-to-text charge on work already in flight, so the cost of the two mistakes is
 * not symmetric and the threshold sits well clear of the honest case.
 */
export const TRANSCRIPT_GRACE_MS = 15 * 60 * 1000;

/**
 * Has this call waited longer than transcription can honestly take?
 *
 * Measured from `ended_at` rather than `started_at`, because transcription of the saved recording
 * begins when the recording does — a forty-minute call is not overdue thirty minutes in.
 * `started_at` is the fallback for a session that never recorded an end, and it can only make this
 * function ANSWER LATER than the truth, never earlier, which is the safe direction.
 *
 * FALSE WHENEVER THE ANSWER IS NOT KNOWN. No timestamp, an unparseable one, or a clock that puts
 * the call in the future all return false — that keeps the softer "still being turned into a
 * transcript" sentence, which is the right way to be wrong. A phone's clock can be anything at all,
 * and telling a rep their call failed because their date is set wrong would be a new false claim
 * replacing the one this removes.
 */
/**
 * What the sessions list says about a call whose words never arrived.
 *
 * SHORT, because it sits in a row beside four other facts. It names the CALL's problem rather than
 * the system's - a rep does not care that a transcription did not return, they care that this
 * conversation has no words in it and that something can still be done.
 */
export const NO_WORDS_CHIP = 'No words came back';

/** The same fact spoken as a sentence, appended to the row's accessible name. */
export const NO_WORDS_SPOKEN = 'no words came back from this call';

/**
 * Should the list flag this row?
 *
 * COMPUTED FROM WHAT THE LIST ALREADY HOLDS - the segment count, whether the server has audio, and
 * the two timestamps - so this costs no extra request. That is the whole reason it can exist: the
 * obvious flag for this class would need a per-row query, and a list that fires one of those per
 * row is a list nobody keeps.
 *
 * `segmentCount` NULL MEANS THE COUNT COULD NOT BE READ, and is deliberately not flagged. Only an
 * exact zero is a real answer. Flagging an unknown would put a red mark on a healthy call because a
 * side query failed, which is the same error this whole area exists to remove.
 */
export function noWordsCameBack(
  row: {
    segmentCount: number | null;
    audio_asset_url: string | null;
    ended_at: string | null;
    started_at: string;
  },
  now: Date,
): boolean {
  if (row.segmentCount !== 0) return false;
  if (!row.audio_asset_url) return false;
  return transcriptOverdue(row.ended_at, row.started_at, now);
}

export function transcriptOverdue(
  endedAt: string | null | undefined,
  startedAt: string | null | undefined,
  now: Date,
): boolean {
  const at = firstTime(endedAt, startedAt);
  if (at === null) return false;
  /*
    ONE COMPARISON, AND IT ALREADY COVERS THE ODD CASES. This was written with explicit guards for
    a negative wait and a non-finite one, and a mutation proved both were unreachable by effect: a
    negative number is not greater than fifteen minutes, and neither is NaN, so removing either
    guard changed no answer and failed no test. A branch that cannot change an outcome is not a
    safeguard, it is a claim that there is a risk here which there is not - and the next person to
    read it would trust it.

    The BEHAVIOUR those guards described is still exactly right and still tested: a phone whose
    clock is behind puts the call in the future, and this answers false rather than telling a rep
    their recording failed because their date is set wrong.
  */
  return now.getTime() - at > TRANSCRIPT_GRACE_MS;
}

/** The first of these that is a real instant, or null when neither is. */
function firstTime(...values: (string | null | undefined)[]): number | null {
  for (const value of values) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const t = Date.parse(value);
    if (Number.isFinite(t)) return t;
  }
  return null;
}
