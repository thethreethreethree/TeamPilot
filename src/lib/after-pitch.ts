/**
 * The After Pitch debrief — "between doors", which is where a phone is.
 *
 * The route's own words for it: *"the rep's 'between doors' debrief"*. It is the
 * single most phone-shaped thing in the whole product — a rep standing on a path
 * with ninety seconds before the next house, reading what just happened.
 *
 *   GET  /api/coach/sales-session/[id]/after-pitch  → read back the latest
 *   POST /api/coach/sales-session/[id]/after-pitch  → generate and store one
 *
 * THE PRIVACY RULE IS THE SERVER'S AND IS NOT REPRODUCED HERE. The route strips
 * the private self-assessment scores for anyone who is not the session's owner,
 * because — in its own words — "the scores are a mirror for the rep, not a
 * manager scorecard". This client therefore renders whatever it is given and
 * NEVER reconstructs a score from anything else: if the field is absent, the
 * viewer was not meant to see it, and inferring it back would defeat a
 * deliberate structural privacy boundary.
 *
 * `isOwner` comes back alongside so the screen can word itself honestly rather
 * than guessing why something is missing.
 *
 * GENERATING IS EXPENSIVE AND IS NEVER AUTOMATIC. POST runs the coaching engines
 * over a whole call. A screen that fired that on open would spend a rep's money
 * every time they glanced at a session — so it happens only when they ask.
 */
import { coachGet, coachPost } from '@/lib/coach-api';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';
import { type RecoveryStatus, isRecoveryStatus } from '@/lib/transcript-recovery';

export type Strength = { point: string; example: string };
export type Growth = { opportunity: string; nextStep: string };

export type AfterPitch = {
  hasSignal: boolean;
  narrative: { hasSignal: boolean; strengths: Strength[]; growthAreas: Growth[] };
  /**
   * Absent for a manager: stripped server-side, deliberately.
   *
   * `key` AND `caveat` WERE ON THE WIRE ALL ALONG and this type was dropping them. The scoring
   * engine sets `caveat` on `talk_ratio` when the customer side carries zero transcribed words, and
   * the website reads exactly that field to tell a one-sided call apart from a failed write-up.
   * Narrowing them away here is why the app could not tell those two apart, and so offered a rebuild
   * that could never work. See `customerSideMissing` in `after-pitch-empty.ts`.
   */
  scores?: { key?: string; label?: string; score?: number; caveat?: boolean }[];
  focus: { focus: string; why: string } | null;
};

export type AfterPitchResult =
  | { ok: true; summary: AfterPitch | null; isOwner: boolean }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message?: string };

function classify(e: unknown): AfterPitchResult {
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403 || status === 404) {
    return { ok: false, reason: 'needs-shim', why: authFailureOf(e) };
  }
  return {
    ok: false,
    reason: 'failed',
    message: e instanceof Error && e.message ? e.message : undefined,
  };
}

export async function readAfterPitch(sessionId: string): Promise<AfterPitchResult> {
  try {
    const data = await coachGet<{ summary: AfterPitch | null; isOwner: boolean }>(
      `/api/coach/sales-session/${sessionId}/after-pitch`,
    );
    return { ok: true, summary: data?.summary ?? null, isOwner: Boolean(data?.isOwner) };
  } catch (e) {
    return classify(e);
  }
}

export async function generateAfterPitch(sessionId: string): Promise<AfterPitchResult> {
  try {
    const data = await coachPost<{ summary: AfterPitch | null; isOwner: boolean }>(
      `/api/coach/sales-session/${sessionId}/after-pitch`,
      {},
    );
    return { ok: true, summary: data?.summary ?? null, isOwner: Boolean(data?.isOwner) };
  } catch (e) {
    return classify(e);
  }
}

/**
 * Ask the server to read the saved recording again.
 *
 * WHY THE APP NEEDS THIS AT ALL, given the hourly sweep already recovers these calls unattended:
 * the sweep is capped at six recoveries an hour across every company, so a rep who opens a blank
 * call at a door can be waiting a long time and has no way to know anything is coming. This is the
 * same route the website calls when a rep opens such a call, and the server's own
 * `auto_recover_attempted_at` marker is what stops the work being paid for twice.
 *
 * EVERY OUTCOME IS A NAMED STATUS, never a throw swallowed into silence. The card says a different
 * sentence for each, because "there is no saved recording" and "the speech service is down" ask
 * completely different things of the rep.
 */
export async function reReadRecording(sessionId: string): Promise<RecoveryStatus> {
  try {
    const data = await coachPost<{ status?: string }>(
      `/api/coach/sales-session/${sessionId}/auto-recover`,
      {},
    );
    return isRecoveryStatus(data?.status) ? data.status : 'failed';
  } catch (e) {
    /**
     * The route answers 409 for `canonical` and for `no-audio`, and 4xx/5xx for `failed`, so those
     * arrive here as a throw. They are ANSWERS rather than faults, and the HTTP code cannot tell the
     * first two apart - both are 409, one is good news and the other a dead end. So the server's own
     * status string is preferred over the mere fact that it threw; `ApiError` carries it for exactly
     * this reason. A throw with no status string in it is a genuine failure.
     */
    const status = (e as { serverStatus?: string | null })?.serverStatus;
    return isRecoveryStatus(status) ? status : 'failed';
  }
}

/**
 * Is there anything in this debrief worth showing?
 *
 * Re-exported from `after-pitch-empty.ts`, which owns it. It moved because THIS file
 * imports the network client (`coach-api` → `expo/fetch`, a native module), so a rule
 * living here cannot be exercised by a test at all. Re-exporting rather than copying keeps
 * ONE definition — this project has already paid for a duplicated rule, where a band
 * threshold in two places told one rep "Elite" on one screen and "Strong" on another.
 *
 * A CORRECTION TO WHAT THIS COMMENT USED TO SAY, because it outlived its own truth by about
 * an hour. It read: "a summary with no signal must read as 'there was not enough here'".
 * That is right for a genuinely thin call and WRONG for the case that turns out to be most
 * of them — measured 10 September 2026, the calls whose write-up came back empty are the
 * LONGER ones, median 683 words against 362. Whether it was thin or the write-up failed is
 * decided by `emptyReadReason` in the same module, on whether the call carries scores.
 *
 * What has not changed: empty sections must never be drawn. They look like a verdict nobody
 * actually reached, which is the reason this predicate exists.
 */
export { hasContent } from '@/lib/after-pitch-empty';
