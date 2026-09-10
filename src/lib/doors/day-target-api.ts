/**
 * Fetching today's door target. The reading rule lives in `day-target-view.ts`,
 * which imports nothing native so it can actually be tested.
 */
import { coachGet } from '@/lib/coach-api';
import { authFailureOf } from '@/lib/auth-failure';
import { readDayTarget, type DayTargetResult } from './day-target-view';

/**
 * Fetch today's target for the device's own timezone.
 *
 * THE TIMEZONE IS SENT, NOT ASSUMED. The server decides which local day this is,
 * and a rep knocking at 11:50pm must land on the day they are actually working —
 * so the device's IANA zone goes with the request rather than letting the server
 * guess from a UTC clock.
 */
export async function fetchDayTarget(timeZone: string): Promise<DayTargetResult> {
  try {
    const payload = await coachGet<unknown>(
      `/api/coach/doorlog/day-target?tz=${encodeURIComponent(timeZone)}`,
    );
    const view = readDayTarget(payload);
    if (!view) return { ok: false, reason: 'failed' };
    return { ok: true, view };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    // 503 is the documented "this migration has not rolled out here" answer.
    if (status === 503) return { ok: false, reason: 'unavailable' };
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

