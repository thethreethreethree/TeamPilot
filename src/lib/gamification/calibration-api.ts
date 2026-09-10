/**
 * Reading and writing Score Calibration.
 *
 * BOTH HALVES GO THROUGH THE COACH ROUTE, unlike every other gamification
 * surface. `gamification_calibration` has no client write policy, and the GET
 * side does real work the phone must not duplicate: it picks the next unscored
 * session, ANONYMISES the transcript, and withholds the model's scores until the
 * manager has submitted. Reading the table directly would hand the phone the
 * un-anonymised session and the model's answer — defeating the blind, which is
 * the entire point of the screen.
 *
 * THE ROUTE IS LIVE. This used to say calibration "waits on the backend branch";
 * the route resolves a mobile Bearer token like every other coach route, and
 * checking that rather than assuming it is what corrected this. What remains is
 * telling the two real refusals apart: a manager whose session expired, and a
 * route that refused a live token. The old code called both "not switched on
 * yet" and told the manager signing in again would not help — which is the one
 * thing that WOULD have helped.
 */
import { coachGet, coachPost } from '@/lib/coach-api';
import { authFailureMessage, type AuthFailure } from '@/lib/auth-failure';

import type { DimensionReport, Scores } from './calibration';

export type CalibrationReport = {
  n: number;
  perDimension: DimensionReport[];
  worstDisagreements: {
    sessionId: string;
    dimension: string;
    human: number;
    model: number;
    diff: number;
  }[];
  overallTrustworthy: boolean | null;
};

export type CalibrationState = {
  report: CalibrationReport | null;
  scored: number;
  pool: number;
  /** The next transcript to score — anonymised, model scores withheld. */
  next: { sessionId: string; transcript: string } | null;
};

export type CalibrationLoad =
  | { kind: 'ready'; state: CalibrationState }
  /** The caller is not a manager. A 403 is an answer, not a failure. */
  | { kind: 'not-a-manager' }
  /** The rep's session ended. Signing in again IS the fix, so the screen says so. */
  | { kind: 'signed-out' }
  /** The route refused a live token. Retrying will not help, so the screen says so. */
  | { kind: 'route-refused' }
  | { kind: 'error'; message: string };

export async function fetchCalibration(): Promise<CalibrationLoad> {
  try {
    const d = await coachGet<CalibrationState>('/api/coach/gamification/calibration');
    return { kind: 'ready', state: d };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    const why = (e as { authFailure?: AuthFailure | null })?.authFailure ?? null;
    // Three different answers that would read identically if collapsed, and mean opposite things: "this is not
    // for you", "your session ended", and "the route refused a live token". Only the middle one has a fix the
    // manager can perform, and the old code was actively telling them it did not.
    if (status === 403) return { kind: 'not-a-manager' };
    if (status === 401 && why === 'signed-out') return { kind: 'signed-out' };
    if (status === 401 || status === 404) return { kind: 'route-refused' };
    return { kind: 'error', message: 'Calibration could not be loaded. Try again when you have signal.' };
  }
}

/** Submit a blind score and receive the model's, for the reveal. */
export async function submitCalibration(
  sessionId: string,
  scores: Scores,
): Promise<{ model: Record<string, number>; human: Record<string, number> } | string> {
  try {
    return await coachPost<{ model: Record<string, number>; human: Record<string, number> }>(
      '/api/coach/gamification/calibration',
      { sessionId, scores },
    );
  } catch (e) {
    const status = (e as { status?: number })?.status;
    const why = (e as { authFailure?: AuthFailure | null })?.authFailure ?? null;
    if (status === 403) return 'Calibration is for managers.';
    if (status === 401 || status === 404) return authFailureMessage(why ?? 'route');
    return 'That did not save. Your scores are still on screen — try again when you have signal.';
  }
}
