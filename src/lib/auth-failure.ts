/**
 * Telling "you are signed out" apart from "the route refused your token".
 *
 * BOTH ARRIVE AS A 401, and the app currently treats every one of them as the
 * backend not being deployed. That is right most of the time and wrong in the
 * case that matters most:
 *
 *   a rep is removed from the company, or changes their password on the
 *   website, or their refresh token is revoked. Every screen then tells them
 *   the backend has not been deployed yet. They wait. Nothing anybody deploys
 *   will ever fix it, because the answer was "sign in again" — and the app
 *   never said so.
 *
 * THE SIGNAL IS THE SESSION ITSELF, checked AFTER the refresh has already been
 * tried and failed (coach-api does that once, internally). At that point:
 *
 *   no session, or one whose refresh could not renew it → the rep is signed out
 *   a live session, still 401 → the token is fine and the ROUTE rejected it
 *
 * WHEN IT CANNOT TELL, IT SAYS THE ROUTE. Guessing "signed out" would throw a
 * working rep back to a login screen and lose whatever they were holding — the
 * more expensive of the two mistakes by a wide margin.
 */

export type AuthFailure = 'signed-out' | 'route';

/**
 * The verdict `coach-api` attached to a thrown error, or null when it carried none.
 *
 * Every module that classifies a failed request reads it the same way, because the alternative — each of them
 * poking at the error shape itself — is how nine modules ended up with nine slightly different opinions about the
 * same 401. Null is a real answer, not a missing one: it means nothing knew, and the caller must treat it as a
 * route refusal rather than guess.
 */
export function authFailureOf(e: unknown): AuthFailure | null {
  return (e as { authFailure?: AuthFailure | null } | null)?.authFailure ?? null;
}

/**
 * What a 401 meant, given the session that exists after the retry.
 *
 * `expiresAt` is seconds since the epoch, as Supabase reports it.
 */
export function classify401(
  session: { expiresAt: number | null } | null,
  nowMs: number,
): AuthFailure {
  if (!session) return 'signed-out';
  if (session.expiresAt === null) return 'route';
  // A token the server would reject on sight. Refresh has already had its go.
  return session.expiresAt * 1000 <= nowMs ? 'signed-out' : 'route';
}

/** What to tell the rep. Each says what to DO, not merely what happened. */
export function authFailureMessage(kind: AuthFailure): string {
  if (kind === 'signed-out') {
    return 'You have been signed out. Sign in again to see this — nothing you recorded is lost, it is still on this phone.';
  }
  // WHAT THIS USED TO SAY, and why it changed (4 September 2026). It read "this needs a change on the website
  // that has not gone live". That was true when every coach route was cookie-only. It is not true now: all of
  // them accept a phone token, so this message was naming a CAUSE the app cannot see and promising a deploy that
  // has already happened. It is the one sentence in the app repeated at nearly every 401, so getting it wrong was
  // wrong in a lot of places at once — which is exactly why it is fixed HERE, at the single point every screen
  // funnels through, rather than screen by screen.
  //
  // What it must still do is stop a rep pulling to refresh all day: retrying and re-signing-in genuinely cannot
  // fix a route that refuses a live token. So it says that, without inventing the reason.
  return 'The website turned this request down. Signing in again or retrying will not help, and nothing you recorded is lost — this one needs somebody to look at the server.';
}
