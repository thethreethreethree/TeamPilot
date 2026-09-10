/**
 * Closing a long call into parts instead of letting it become unsendable.
 *
 * THE PROBLEM THIS SOLVES, and why it got worse. The server refuses an upload
 * over 25 MB, which at this app's speech settings is about 100 minutes. Nothing
 * used to stop a recording at that point: it kept growing, and the rep found out
 * at upload time that the whole call could not be sent. The audio survived on the
 * phone and was useless — a conversation that cannot be transcribed cannot be
 * coached.
 *
 * Then background recording was fixed, which is right and makes this MORE likely:
 * a rep pockets the phone and the clock genuinely keeps running now.
 *
 * WHAT HAPPENS INSTEAD. Shortly before the ceiling the app closes the current
 * file, saves it as a part, and immediately starts the next one. A long
 * appointment arrives as two or three sendable recordings rather than one
 * unsendable one.
 *
 * THE MARGIN IS NOT DECORATION. The split is checked on a timer, and a timer can
 * be late — the app may be in the background, the JS thread may be busy writing
 * the previous part. Splitting exactly AT the ceiling would leave no room for
 * that lateness, and a part that lands a few seconds over is refused for the same
 * reason the whole call would have been. Two minutes of headroom costs nothing
 * and is the difference between a rule and a hope.
 *
 * WHAT IS LOST, said plainly rather than hidden: the join. A sentence spoken
 * across the moment of the split lands half in one part and half in the next, and
 * the coach scores two conversations rather than one. That is the real cost of
 * this choice, and it is still better than a call nobody can send.
 *
 * PURE, and free of native imports, so the arithmetic that decides when a rep's
 * call is cut can be tested rather than discovered on a long appointment.
 */
import { MAX_RECORDING_SECONDS } from './recording-budget';

/** Headroom below the server's ceiling. See the note above on lateness. */
export const SPLIT_MARGIN_SECONDS = 120;

/** Where a part is closed. Always below the ceiling, never at it. */
export const SPLIT_AT_SECONDS = Math.max(60, MAX_RECORDING_SECONDS - SPLIT_MARGIN_SECONDS);

/**
 * How long before the split the rep is told it is coming.
 *
 * They are told BEFORE it happens because a recording ending without anybody
 * pressing Stop is a thing this app has never done, and a rep who sees it happen
 * with no warning has every reason to think it broke.
 */
export const SPLIT_WARNING_SECONDS = 300;

/** Is the current part long enough to close? */
export function shouldSplit(elapsedSeconds: number): boolean {
  if (!Number.isFinite(elapsedSeconds)) return false;
  return elapsedSeconds >= SPLIT_AT_SECONDS;
}

/** Should the rep be warned that a split is coming? */
export function shouldWarnOfSplit(elapsedSeconds: number): boolean {
  if (!Number.isFinite(elapsedSeconds)) return false;
  return elapsedSeconds >= SPLIT_AT_SECONDS - SPLIT_WARNING_SECONDS && !shouldSplit(elapsedSeconds);
}

/**
 * The name a saved part carries.
 *
 * IT IS NAMED AT ALL because automatic sending only ever touches a recording
 * that has a name. A part the rep never asked to create must not sit on the
 * phone waiting to be named by somebody who does not know it exists.
 *
 * The rep can rename it on the recordings screen; this is a name that says what
 * the thing is, not a good title for the conversation.
 */
export function partLabel(part: number): string {
  return `Long call, part ${Math.max(1, Math.trunc(part))}`;
}

/** What the rep reads a few minutes before the first split. */
export function splitWarningText(): string {
  return `This call is close to the longest single recording the server accepts. In a few minutes the app will save what it has and keep recording in a new part, so nothing is lost.`;
}

/** What the rep reads the moment a part is closed and the next one starts. */
export function splitNoticeText(partJustSaved: number): string {
  return `Part ${partJustSaved} has been saved and recording has carried on in part ${partJustSaved + 1}. Nothing was lost except the moment of the join. Press Stop when the call ends.`;
}

/**
 * What the rep reads when a DOOR PITCH hits the ceiling.
 *
 * A pitch is not split. A doorstep pitch that has run past an hour and a half is
 * not a pitch any more, and starting a second part would be recording something
 * the outcome prompt has no question for. It stops, and the rep is asked how it
 * went, which is what pressing Stop would have done.
 */
export function pitchCeilingText(): string {
  return `This pitch reached the longest recording the server accepts, so it has been stopped and saved. Say how it went and it will send like any other.`;
}
