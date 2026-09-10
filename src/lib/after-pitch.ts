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

export type Strength = { point: string; example: string };
export type Growth = { opportunity: string; nextStep: string };

export type AfterPitch = {
  hasSignal: boolean;
  narrative: { hasSignal: boolean; strengths: Strength[]; growthAreas: Growth[] };
  /** Absent for a manager: stripped server-side, deliberately. */
  scores?: { label?: string; score?: number }[];
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
 * Is there anything in this debrief worth showing?
 *
 * `hasSignal` is the server's own honesty flag — it is false when the call was
 * too short or too empty to say anything about. A summary with no signal must
 * read as "there was not enough here", never as a debrief with empty sections,
 * because empty sections look like a verdict nobody actually reached.
 */
export { hasContent } from '@/lib/after-pitch-empty';
