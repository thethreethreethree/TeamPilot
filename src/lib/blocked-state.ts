/**
 * What a screen says when the server would not answer it.
 *
 * WHY THIS EXISTS, and it is not tidiness. Ten screens each carried their own
 * version of one paragraph:
 *
 *   "Not switched on yet — the same server the website uses does not accept the
 *    app's sign-in yet. Nothing is wrong with your account."
 *
 * That was true while every coach route was web-cookie-only. It stopped being
 * true when the routes started accepting a phone token, and then it was ten
 * separate lies rather than one — which is the cost of writing the same sentence
 * in ten places instead of once.
 *
 * THE SENTENCE THAT MATTERS MOST IS THE ONE THAT WAS MOST WRONG. "Nothing is
 * wrong with your account" is exactly backwards for a rep whose session has
 * expired: something IS wrong with their account, signing in again fixes it in
 * five seconds, and the app was telling them not to bother. `coach-api` already
 * works out which of the two it is, AFTER its one refresh attempt. This consumes
 * that verdict; it never re-derives one from a status code, because re-deriving
 * it is how the old paragraph came back.
 *
 * NO CAUSE THE APP CANNOT SEE. A route refusing a live token might be a deploy,
 * a permission, a bad gateway, or something nobody has thought of. The screen
 * says what the rep can do about it — nothing, and nothing is lost — and leaves
 * the diagnosis to whoever can actually look.
 */

import type { AuthFailure } from './auth-failure';

export type BlockedState = { title: string; body: string };

/**
 * `why` is the verdict from `coach-api`, or null when the failure never carried
 * one. Null means route: guessing "signed out" would throw a working rep at a
 * login screen and lose what they were holding, which is much the more
 * expensive of the two mistakes.
 *
 * `subject` names what the rep was looking at, so the sentence reads as being
 * about their screen rather than about the system in general. It is never
 * interpolated into the signed-out case, where the answer is the same wherever
 * they are standing.
 */
export function blockedState(why: AuthFailure | null, subject: string): BlockedState {
  if (why === 'signed-out') {
    return {
      title: 'You have been signed out',
      body:
        'Sign in again and this comes straight back. Nothing you recorded is lost — it is still on this phone.',
    };
  }
  return {
    title: 'Not available right now',
    body: `The server turned down the request for ${subject}. Signing in again or pulling to refresh will not help, and nothing you recorded is lost — this one needs somebody to look at the server.`,
  };
}

/**
 * The same two cases, for a recording that could not be sent.
 *
 * Separate wording from `blockedState` because the reassurance is different and it is the part that matters: a rep
 * who has just recorded a real conversation needs to know the FILE is safe before anything else. The old sentence —
 * "Sending is not switched on yet. Your recording is safe on this phone and will send once it is." — promised a
 * switch that had already been flipped, and told a signed-out rep to wait rather than sign in.
 */
export function uploadBlockedMessage(why: AuthFailure | null): string {
  if (why === 'signed-out') {
    return 'You have been signed out. Your recording is safe on this phone — sign in again and it sends itself.';
  }
  return 'The server turned this recording down. It is safe on this phone, and retrying will not help until somebody looks at the server.';
}
