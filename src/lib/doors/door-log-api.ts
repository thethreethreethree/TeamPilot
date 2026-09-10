/**
 * Sending knocks, and reading the day's totals.
 *
 * THE ROUTE THIS TALKS TO, read rather than assumed
 * (`api/coach/sales-session/door-log/route.ts`):
 *
 *   POST { kind: "knock", outcome, localDate, clientKnockId }
 *     Returns immediately. Idempotent on clientKnockId, which its own comment
 *     says exists because an "offline queue may retry" — so a repeat is safe and
 *     a lost response is not a lost door.
 *
 *   GET ?date=YYYY-MM-DD   → that local day's totals for the caller alone
 *   GET ?range=all         → all-time totals
 *
 * WHAT THE SERVER DOES ON A READ FAILURE IS WORTH COPYING, and this client does:
 * the route returns a 502 rather than a strip of zeros, because "a KPI read
 * error returns a 5xx, NOT a fabricated 0 strip". A zero that is really a
 * failure is the same lie the home screen's em dash exists to prevent.
 *
 * IT ACCEPTS THE APP'S SIGN-IN. This said the opposite - "cookie-only today ...
 * answers 401 until the Bearer shim covers it" - and that stopped being true.
 * The route resolves a Bearer token, and on 4 September it answered
 * `GET /door-log?date=2026-08-31` with 8 knocks and 6 sold for this account.
 *
 * It was BROKEN for a different reason, and only until that same day: the route
 * resolved the caller's client correctly and then called helpers in
 * `lib/data/doorlog.ts` that built their own COOKIE client and discarded it. So
 * reads came back as a confident `0` with a 200, and writes were refused with a
 * 500. Fixed server-side; a regression test now fails if a rep-facing helper
 * reaches for the cookie client again.
 *
 * The local-first design below is kept anyway, and not because the server is
 * doubted: a rep knocks doors in dead zones, so knocks accumulate on the phone
 * and go when there is signal. That was always the reason.
 */
import { coachGet, coachPost } from '@/lib/coach-api';
import type { Knock } from './knock-store';
import { supabase } from '@/lib/supabase';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';

/** The day's counts, as the route returns them. */
/**
 * The day's totals, exactly as `/door-log` sends them — no more.
 *
 * TWO OPTIONAL FIELDS WERE REMOVED HERE on 4 September, because a type that
 * promises data nobody sends is an invitation to build a tile that renders
 * `undefined`:
 *
 *   `presentations`       — no such thing exists server-side. Not a column, not
 *                           an outcome, not in any view.
 *   `nonDecisionMakers`   — the OUTCOME is real ('non_decision_maker' is in the
 *                           enum and `rep_kpi_daily` counts it), but the
 *                           `/door-log` route's reducer does not return it. To
 *                           show it, the route has to sum it first.
 *
 * WHAT IS NOT A GAP, checked rather than assumed: "Doors today" already counts
 * not-the-decision-maker knocks. `doors_knocked` in `rep_kpi_daily` is
 * `count(*)` over every outcome, so the headline figure is complete — only the
 * BREAKDOWN omits that one, and no screen shows a tile for it.
 */
export type DoorTotals = {
  doorsKnocked: number;
  sold: number;
  goBacks: number;
  notInterested: number;
};

export type KnockSend =
  | { ok: true }
  /** The app cannot make this write yet. Every knock will hit the same wall. */
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  /** The server refused this specific knock; retrying sends the same body. */
  | { ok: false; reason: 'rejected'; message?: string }
  /** No verdict — a dead connection. Always worth another try. */
  | { ok: false; reason: 'transient'; message?: string };

export async function sendKnock(knock: Knock): Promise<KnockSend> {
  try {
    await coachPost('/api/coach/sales-session/door-log', {
      kind: 'knock',
      outcome: knock.outcome,
      localDate: knock.localDate,
      clientKnockId: knock.clientKnockId,
    });
    return { ok: true };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    const message = e instanceof Error && e.message ? e.message : undefined;
    if (status === 401 || status === 403 || status === 404) {
      return { ok: false, reason: 'needs-shim', why: authFailureOf(e) };
    }
    // 400 is a body the server understood and refused — a bad outcome name or a
    // malformed date. Retrying sends the identical body to the identical rule.
    if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
      return { ok: false, reason: 'rejected', message };
    }
    return { ok: false, reason: 'transient', message };
  }
}

/**
 * The server's totals for one local day, or null when they cannot be read.
 *
 * Null rather than zeros, deliberately: the screen shows the rep's own local
 * count either way, and a server strip of zeros laid over a real day's work
 * would read as the day having been erased.
 */
export async function fetchDayTotals(date: string): Promise<DoorTotals | null> {
  try {
    return await coachGet<DoorTotals>(
      `/api/coach/sales-session/door-log?date=${encodeURIComponent(date)}`,
    );
  } catch {
    return null;
  }
}

/**
 * The id of this rep's most recently recorded pitch, or null.
 *
 * Direct under RLS — `pitches` is scoped by `rep_id`, so the policy rather than
 * a parameter decides what comes back, exactly as the web's /latest redirect
 * does. Distinguishes "no pitch" (null) from "could not read" (failed).
 */
export async function fetchLatestPitchId(
  userId: string,
): Promise<{ pitchId: string | null; failed: boolean }> {
  try {
    const { data, error } = await supabase
      .from('pitches')
      .select('id')
      .eq('rep_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { pitchId: null, failed: true };
    return { pitchId: (data?.id as string | undefined) ?? null, failed: false };
  } catch {
    return { pitchId: null, failed: true };
  }
}
