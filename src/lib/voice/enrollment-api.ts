/**
 * Reading and writing the rep's enrolled pitch reference.
 *
 * `GET  /api/coach/voice-enrollment` -> `{ enrolled, f0Hz }`
 * `POST /api/coach/voice-enrollment` `{ f0Hz, voicedFrames }` -> `{ enrolled, f0Hz }`
 *
 * Both shapes read from the route's own Zod schema and its handlers, not from
 * the spec doc.
 *
 * THREE ANSWERS THAT ARE NOT THE SAME THING, and the route already distinguishes
 * all three, so the app must not collapse them:
 *
 *   422  the take was too thin or out of range. The rep's to fix: read again.
 *   503  migration 0246 has not applied here. Nothing the rep can do, and
 *        telling them to try again would be sending them in a circle.
 *   500  something else broke. Neither of the above.
 *
 * ONLY A NUMBER IS SENT. The audio never leaves the phone and is deleted as soon
 * as the number is derived - see `enroll-flow.ts`. That is what keeps this off
 * the biometric-data surface, and it is a property of the code, not a promise in
 * a privacy line.
 */
import { coachGet, coachPost } from '@/lib/coach-api';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';

export type EnrollmentStatus = {
  enrolled: boolean;
  /** The stored reference in Hz, or null when there is none. */
  f0Hz: number | null;
};

export type StatusResult =
  | { ok: true; status: EnrollmentStatus }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message?: string };

export type SaveResult =
  | { ok: true; status: EnrollmentStatus }
  /** The take was refused. The rep reads again. */
  | { ok: false; reason: 'take-refused'; message?: string }
  /** This environment has not had migration 0246. Not the rep's problem. */
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message?: string };

export function readStatus(payload: unknown): EnrollmentStatus {
  const o = (payload ?? null) as Record<string, unknown> | null;
  const f0 = o?.f0Hz;
  return {
    enrolled: o?.enrolled === true,
    // NULL, never 0. A rep with no reference has no number, and "0 Hz" would
    // read as a measurement of silence rather than as an absence.
    f0Hz: typeof f0 === 'number' && Number.isFinite(f0) ? f0 : null,
  };
}

export async function fetchEnrollment(): Promise<StatusResult> {
  try {
    return { ok: true, status: readStatus(await coachGet<unknown>('/api/coach/voice-enrollment')) };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401 || status === 404) {
      return { ok: false, reason: 'needs-shim', why: authFailureOf(e) };
    }
    return { ok: false, reason: 'failed', message: messageOf(e) };
  }
}

export async function saveEnrollment(body: {
  f0Hz: number;
  voicedFrames: number;
}): Promise<SaveResult> {
  try {
    const res = await coachPost<unknown>('/api/coach/voice-enrollment', body);
    return { ok: true, status: readStatus(res) };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    // 422 is the rep's to act on; 503 is not. Folding them together would tell a
    // rep to keep reading into a microphone at a column that does not exist.
    if (status === 422) return { ok: false, reason: 'take-refused', message: messageOf(e) };
    if (status === 503) return { ok: false, reason: 'unavailable' };
    if (status === 401 || status === 404) {
      return { ok: false, reason: 'needs-shim', why: authFailureOf(e) };
    }
    return { ok: false, reason: 'failed', message: messageOf(e) };
  }
}

function messageOf(e: unknown): string | undefined {
  return e instanceof Error && e.message ? e.message : undefined;
}

/** What the rep reads when the server has not had the migration. */
export const ENROLL_UNAVAILABLE_TITLE = 'Not available yet';
export const ENROLL_UNAVAILABLE_BODY =
  'Voice enrollment is not switched on for this app yet. Nothing you have recorded is affected, and you can keep working as normal.';
