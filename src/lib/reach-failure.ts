/**
 * WHY a request failed, said only when the app actually knows.
 *
 * REPORTED FROM A PHONE WITH FULL BARS AND FAST WI-FI, 4 September: "Could not
 * reach the coach. Your draft is still here — try again when you have signal."
 * The founder's reply was the whole bug in one line: *"i have a full signal and
 * really fast internet"*. The app named a cause it had never checked, and the
 * cause it named was the one thing that was definitely fine — so the only action
 * it offered was the only action that could not possibly work.
 *
 * FIFTEEN SCREENS SAID IT. Every data screen's fallback sentence ended in "try
 * again when you have signal" or "check your connection", and `humanError` hands
 * that fallback to TWO different failures that have nothing in common:
 *
 *   - no HTTP status at all — a dropped socket, DNS, a parse. MAYBE the signal.
 *   - a 5xx — a server that answered and broke. NEVER the signal.
 *
 * The second one is what a rep on good Wi-Fi hits, and it is the one where the
 * message is not merely unhelpful but false.
 *
 * THE FIX IS NOT NEW INFORMATION. `useOnline` has existed the whole time, and
 * `coach.tsx` — the screen in the screenshot — already imported it. The
 * connection state was in the same file as the sentence that ignored it. So this
 * module does not detect anything; it just refuses to let a screen assert a cause
 * without passing in what it knows.
 *
 * THREE CAUSES, because "not the signal" is not one thing:
 *
 *   offline      the phone says it has no network. The original sentence, now
 *                said only when it is true.
 *   server       a server answered with a 5xx. Their end, not yours, and saying
 *                so stops a rep hunting for better signal that will not help.
 *   unreachable  the phone believes it is online and the request still never
 *                landed. HONEST ABOUT THE LIMIT: it reports what is known —
 *                connection looks fine, request did not arrive — and does not
 *                pick between a flaky link and a server that is down.
 *
 * PURE, so the sentence a rep reads is a tested rule rather than a ternary
 * repeated in fifteen screens, which is how they drifted apart in the first place.
 */

import { humanError } from '@/lib/error-message';

export type FailureCause = 'offline' | 'server' | 'unreachable';

/**
 * Which of the three this was.
 *
 * `online` is the caller's `useOnline()` reading, where NULL MEANS NOT YET KNOWN
 * and is treated as online — the same rule `isOffline` already applies, and for
 * the same reason: telling a rep on a good connection that they are offline is
 * the worse of the two mistakes.
 *
 * A status of any kind means a server answered, so it is never the signal —
 * including a 4xx, which reaches here only when the response carried no sentence
 * of its own for `humanError` to prefer.
 */
export function failureCause(e: unknown, online: boolean | null): FailureCause {
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && Number.isFinite(status)) return 'server';
  return online === false ? 'offline' : 'unreachable';
}

/**
 * The sentence, built around what the rep was trying to do.
 *
 * `what` is a noun phrase that follows "Could not reach" — "the coach", "your
 * numbers", "your team". Written by the screen because only the screen knows.
 *
 * EVERY BRANCH ENDS IN SOMETHING TO DO, including the one where the answer is
 * "nothing you can do" — because a rep who is told to stop trying still needs to
 * know whether the work they were doing is safe, and whether anyone else knows.
 */
export function reachFallback(what: string, cause: FailureCause): string {
  const subject = what.trim() || 'the server';
  if (cause === 'offline') {
    return `Could not reach ${subject} — this phone has no connection. Try again when you have signal.`;
  }
  if (cause === 'server') {
    // Names the thing that is NOT wrong, because that is the belief sending the
    // rep to the window to look for bars.
    return `Could not reach ${subject}. The problem is at the server's end, not your connection — try again in a moment.`;
  }
  return `Could not reach ${subject}, and this phone says its connection is fine. Try again — if it keeps happening, somebody needs to look at the server rather than your signal.`;
}

/**
 * What the screens actually call.
 *
 * WRAPS `humanError` RATHER THAN REPLACING IT, and getting this backwards was a
 * near-miss while writing the fix: calling `reachFallback` directly reads better
 * and silently throws away every sentence a server wrote for a person — "Manager
 * access required", "Deal value must be at most 100000000". Those are the
 * messages that say what to CHANGE, and no screen can reconstruct them.
 *
 * So the preference order is unchanged — our own HumanError, then the server's
 * own sentence, then the fallback. Only the fallback stopped lying.
 */
export function reachError(e: unknown, online: boolean | null, what: string): string {
  return humanError(e, reachFallback(what, failureCause(e, online)));
}
