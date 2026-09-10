/**
 * Reading and writing one rep's daily sales goal.
 *
 * `GET  /api/coach/doorlog/rep-goal?repId=<uuid>` -> { salesGoal, saleValueCents,
 *      unavailable? }. Without `repId` it answers for the caller themselves.
 * `PATCH /api/coach/doorlog/rep-goal` { repId, salesGoal, saleValueCents? }
 *      -> MANAGER only; a rep setting their own goal gets a clean 403.
 *
 * Both shapes were read from the route's own Zod schema and confirmed against
 * production on 10 September, where the GET answered
 * `{"salesGoal":null,"saleValueCents":null}` to the app's own Bearer token.
 *
 * TWO ANSWERS THAT ARE NOT ERRORS, and both need saying rather than swallowing:
 *
 *   unavailable    migration 0248 has not been applied here, so the column the
 *                  cash box needs does not exist. The goal itself still works.
 *   saleValueSaved false when the goal saved but the $-per-sale did not, because
 *                  the route retries the write without that column when 0248 is
 *                  missing. Telling a manager "saved" when half of it was
 *                  dropped is the kind of quiet lie this app keeps finding.
 */
import { coachGet, coachPatch } from '@/lib/coach-api';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';

export type RepGoal = {
  salesGoal: number | null;
  /** In CENTS. Null means the rep's cash box counts sales instead of dollars. */
  saleValueCents: number | null;
  /** True when this environment has not had migration 0248. */
  unavailable: boolean;
};

export type RepGoalResult =
  | { ok: true; goal: RepGoal }
  | { ok: false; reason: 'not-manager' }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message?: string };

export type SaveGoalResult =
  /** Saved. `saleValueSaved` is false when the $-per-sale was dropped. */
  | { ok: true; saleValueSaved: boolean }
  | { ok: false; reason: 'not-manager' }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message?: string };

const nullableNum = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function readRepGoal(payload: unknown): RepGoal {
  const o = (payload ?? null) as Record<string, unknown> | null;
  return {
    // NULL, never 0. "No goal set" sends a manager to set one; "your goal is 0"
    // is a claim about a goal somebody made.
    salesGoal: nullableNum(o?.salesGoal),
    saleValueCents: nullableNum(o?.saleValueCents),
    unavailable: o?.unavailable === true,
  };
}

export async function fetchRepGoal(repId: string): Promise<RepGoalResult> {
  try {
    const payload = await coachGet<unknown>(
      `/api/coach/doorlog/rep-goal?repId=${encodeURIComponent(repId)}`,
    );
    return { ok: true, goal: readRepGoal(payload) };
  } catch (e) {
    return { ok: false, ...classify(e) };
  }
}

export async function saveRepGoal(body: {
  repId: string;
  salesGoal: number;
  saleValueCents: number | null;
}): Promise<SaveGoalResult> {
  try {
    const res = await coachPatch<{ saleValueSaved?: unknown }>(
      '/api/coach/doorlog/rep-goal',
      body,
    );
    // Absent means the route did not say — and since it says so explicitly when
    // it drops the column, absence is treated as saved rather than as doubt.
    return { ok: true, saleValueSaved: res?.saleValueSaved !== false };
  } catch (e) {
    return { ok: false, ...classify(e) };
  }
}

function classify(
  e: unknown,
):
  | { reason: 'not-manager' }
  | { reason: 'needs-shim'; why: AuthFailure | null }
  | { reason: 'failed'; message?: string } {
  const status = (e as { status?: number })?.status;
  // 403 is its OWN answer: the caller is signed in and simply is not a manager.
  // Folding it into a generic failure would tell a rep to try again at something
  // that will never work for them.
  if (status === 403) return { reason: 'not-manager' };
  if (status === 401 || status === 404) {
    return { reason: 'needs-shim', why: authFailureOf(e) };
  }
  return {
    reason: 'failed',
    message: e instanceof Error && e.message ? e.message : undefined,
  };
}
