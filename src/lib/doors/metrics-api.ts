/**
 * Reading Today's Metrics.
 *
 * GET /api/coach/sales-session/todays-metrics?period=day|week|month|all_time
 *
 * RLS-scoped: a rep sees their own.
 *
 * IT ANSWERS THE APP. This said "cookie-only today ... answers 401 until the
 * Bearer shim covers it", and that stopped being true; on 4 September the route
 * returned 200 to the app's own Bearer token.
 *
 * It WAS wrong until that day, in a way no status code showed: the route called
 * `getTodaysMetrics`, which built its own COOKIE client, so for a Bearer caller
 * every figure came back as a confident 0 with a 200. Fixed server-side by
 * passing the caller's client down. The blocked-state copy is kept for a real
 * refusal, which is still possible and still not the rep's fault.
 */
import { coachGet } from '@/lib/coach-api';
import type { Metrics, MetricsPeriod } from './metrics-view';
import { echoMatchesRange, rangeQuery, type DateRange } from './metrics-range';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';

export type MetricsResult =
  | { ok: true; metrics: Metrics }
  /** The app cannot read this yet. Not an error the rep can act on. */
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  /**
   * A custom range was asked for and the answer was not that range.
   *
   * Its own outcome, because it is NOT a failure the rep caused and NOT one a
   * retry of the same request fixes silently. The server answers a bad range
   * with 200 and today's figures (measured 10 September), so this is the only
   * thing standing between the rep and today's eight doors captioned as ten
   * days' work.
   */
  | { ok: false; reason: 'range-not-honoured' }
  | { ok: false; reason: 'failed'; message?: string };

export async function fetchMetrics(
  /** A preset, or a custom window the caller has already validated. */
  period: MetricsPeriod | DateRange,
): Promise<MetricsResult> {
  const custom = typeof period === 'object' ? period : null;
  try {
    const query = custom
      ? rangeQuery(custom)
      : `period=${encodeURIComponent(period as MetricsPeriod)}`;
    const metrics = await coachGet<Metrics>(
      `/api/coach/sales-session/todays-metrics?${query}`,
    );
    // READ THE ECHO. A reversed or malformed range returns 200 with
    // `period:"day"` and today's numbers, so a 200 alone does not mean the answer
    // is the window that was asked for.
    if (custom && !echoMatchesRange(metrics, custom)) {
      return { ok: false, reason: 'range-not-honoured' };
    }
    return { ok: true, metrics };
  } catch (e) {
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
}
