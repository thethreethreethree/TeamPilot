/**
 * What to tell someone whose sign-in did not work.
 *
 * WHY THIS IS ITS OWN FUNCTION. The auth layer used to hand the screen whatever
 * string the auth library produced, for anything it did not specifically
 * recognise. Those strings are written for developers: a rep standing in a
 * stairwell with one bar got "AuthRetryableFetchError" or "Network request
 * failed" — which reads as the app being broken, on the one screen where being
 * locked out means not working today. They would try the password again, then
 * a different password, then give up, and the actual answer was "walk outside".
 *
 * THE ONE THING IT MUST NOT DO. Never say whether an email has an account. A
 * message that distinguishes "no such user" from "wrong password" is an oracle
 * for enumerating who works here, and the sign-in screen is public. Every
 * credential failure gets the same sentence, whatever the server said.
 *
 * WHAT IT DOES INSTEAD. Recognises the failures that have a different ACTION
 * behind them — a connection problem, a rate limit, an unconfirmed address —
 * because those are the cases where the rep can do something, and the something
 * is different each time. Anything genuinely unrecognised gets a plain sentence
 * that says what is known and what to try, rather than a class name.
 *
 * Pure and separate so it can be tested exhaustively without an auth client.
 */

/** Every credential failure, worded identically. See the note above. */
export const CREDENTIALS_MESSAGE = "That email and password don't match an Elostate account.";

export function signInMessage(raw: string | null | undefined): string {
  const text = (raw ?? '').toLowerCase();

  // Wrong password, no such account, malformed login — one answer for all of
  // them, deliberately.
  if (
    text.includes('invalid') ||
    text.includes('bad credentials') ||
    text.includes('grant') ||
    text.includes('not found')
  ) {
    return CREDENTIALS_MESSAGE;
  }

  // The rep is not doing anything wrong and no amount of retyping will help.
  // Named first among the recognised cases because it is by far the likeliest
  // one for a phone used between doors.
  if (
    text.includes('network') ||
    text.includes('fetch') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('offline') ||
    text.includes('connection')
  ) {
    return 'Could not reach Elostate. This is a connection problem, not your password — try again when you have signal.';
  }

  // A real limit with a real wait. Saying so stops the rep hammering the button,
  // which is what extends the lockout.
  if (text.includes('too many') || text.includes('rate limit') || text.includes('429')) {
    return 'Too many attempts. Wait a minute before trying again — trying now makes the wait longer.';
  }

  if (text.includes('confirm')) {
    return 'This account has not been confirmed yet. Check your email for the confirmation link, or ask your manager to resend it.';
  }

  if (text.includes('disabled') || text.includes('banned') || text.includes('suspended')) {
    return 'This account cannot sign in. Ask your manager to check it is still active.';
  }

  // Unrecognised. Says what is known, gives something to try, and does not
  // pretend to be a diagnosis.
  return 'Could not sign you in. Check your connection and try again — if it keeps happening, tell your manager rather than changing your password.';
}
