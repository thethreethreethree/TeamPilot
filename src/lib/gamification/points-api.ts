/**
 * Reading the rep's own points ledger.
 *
 * DIRECT, AND SO NOT WAITING ON A DEPLOY. The web reaches this through
 * /api/coach/gamification/my-points, but migration 0242's SELECT policy is
 * "owner or manager, same company" — so the phone asks for its own rows and the
 * policy, not a parameter, decides what comes back. A rep cannot read a peer's
 * ledger from here any more than they can on the website.
 *
 * READ ONLY, STRUCTURALLY. The table has no INSERT policy at all: the ledger is
 * written by service-role code. There is deliberately no write function in this
 * module, because there is no write the phone could make.
 */
import { supabase } from '@/lib/supabase';
import { coachGet } from '@/lib/coach-api';

import { readMilestoneDates, type MilestoneDates } from './milestone-dates';

import type { PointRow } from './points';

/**
 * PostgREST's own ceiling per request. The build spec is explicit that the
 * summary must be computed over the FULL history and that a client reading the
 * ledger directly has to "page past 1000 rows".
 */
const PAGE = 1000;
/** A hard stop, so a runaway ledger cannot spin forever. 100k rows is far past
 *  any real rep and still terminates. */
const MAX_PAGES = 100;

/**
 * Every ledger row for this rep, paged.
 *
 * THIS USED TO STOP AT 200, and the summary was computed from whatever came
 * back — so a rep past 200 entries was shown FEWER POINTS THAN THEY HAD EARNED.
 * On a screen about somebody's own performance that is the worst kind of wrong:
 * quietly plausible, and always in the direction of undercounting their work.
 * Corrections are ledger rows too, so a busy rep reaches 200 sooner than their
 * session count suggests.
 */
export async function fetchMyPoints(
  userId: string,
): Promise<{ rows: PointRow[]; failed: boolean }> {
  try {
    const all: Record<string, unknown>[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE;
      const { data, error } = await supabase
        .from('agent_point_ledger')
        .select('session_id, points, detail, created_at')
        .eq('agent_id', userId)
        // EVERY reason, corrections included — the owner's decision, 4 September.
        //
        // The spec contradicted itself: section 4 said this read should filter
        // to `session_score`, section 2 said the leaderboard totals SUM(points)
        // with corrections included "so a corrected total stays honest". Both
        // cannot be true of one rep. Filtering here meant a rep who had a call
        // corrected saw one total on Your points and a different one on the
        // Scoreboard, with no way to tell which was right.
        //
        // Section 2's reasoning won: a corrected total IS the honest one, and it
        // is what the board already shows. There is no filter now, so the two
        // screens agree.
        //
        // Nothing produces a correction row yet — I swept every insert in the
        // web repo and only `session_score` is written — so this changes no
        // number today. It changes what happens the day corrections ship, which
        // is the only day it could quietly go wrong.
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) return { rows: [], failed: true };
      if (!data || data.length === 0) break;
      all.push(...(data as Record<string, unknown>[]));
      // A short page is the last page.
      if (data.length < PAGE) break;
    }
    // A failed read is reported by the early return inside the loop above —
    // "you have no points" and "we could not check" are different things to
    // tell somebody about their own performance, so a partial read never
    // silently becomes a total.
    return {
      rows: all.map((r) => ({
        sessionId: (r.session_id as string | null) ?? null,
        points: typeof r.points === 'number' ? r.points : Number.NaN,
        band: readBand(r.detail),
        createdAt: (r.created_at as string) ?? '',
      })),
      failed: false,
    };
  } catch {
    return { rows: [], failed: true };
  }
}

/** The band is a snapshot inside `detail`, so it is read defensively. */
function readBand(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object') return null;
  const b = (detail as Record<string, unknown>).band;
  return typeof b === 'string' && b.trim() ? b.trim() : null;
}


/**
 * The points banked for ONE session, folded across any corrections.
 *
 * WHY IT EXISTS. The Arena links a best call to its session, and a rep who taps
 * "84 points" and lands on a screen that never mentions points is left unsure
 * they opened the right thing. This closes that loop.
 *
 * SCOPED BY THE POLICY, NOT BY THIS FILE. A rep reaches their own; a manager
 * reaches their team's; a peer reaches nothing. Corrections are summed in, so a
 * corrected call shows what it is worth NOW rather than what it was first
 * banked at.
 */
export async function fetchSessionPoints(
  sessionId: string,
): Promise<{ points: number; band: string | null } | null> {
  try {
    const { data, error } = await supabase
      .from('agent_point_ledger')
      .select('points, detail')
      // NO agent filter. Migration 0242's policy is "the owning agent OR a
      // company manager", and the build spec says the same: a rep sees their
      // own, a manager sees their team's, peers never see each other's. Adding
      // `agent_id = me` here would be a SECOND copy of that rule, and the copy
      // was already wrong — it hid a rep's score from the manager whose own
      // alert had just quoted it. The policy decides; this consumes the result.
      .eq('session_id', sessionId);
    if (error || !data || data.length === 0) return null;
    const points = data.reduce(
      (n, r) => (typeof r.points === 'number' && Number.isFinite(r.points) ? n + r.points : n),
      0,
    );
    // The band snapshot from the ORIGINAL banking row, where there is one.
    const band = data.map((r) => readBand(r.detail)).find((b) => b) ?? null;
    return { points, band };
  } catch {
    return null;
  }
}

/**
 * The milestone earned-DATES, from the route rather than from this phone.
 *
 * SPEC §5.3, AND ITS REASON IS STRUCTURAL. `spark` is the rep's FIRST scored
 * pitch and `century` the HUNDREDTH; `deal` and `closer` are the first and
 * tenth SOLD session, which this module does not read at all. The route derives
 * all five where the full history lives. Computing them from what the phone
 * holds would name a plausible wrong day — and a wrong date looks exactly like
 * a right one, which is what makes it worse than no date.
 *
 * SEPARATE FROM `fetchMyPoints`, deliberately. That one reads the ledger
 * DIRECTLY under RLS and does not depend on a route being reachable, which is
 * why the Arena's numbers survive when the network half does not. Folding this
 * into it would make the whole screen fail for the sake of five dates.
 *
 * Returns null on any failure, and null is rendered as "can't check now" — not
 * as "not earned". A rep who has closed ten deals must never be told otherwise
 * because a request timed out.
 */
export async function fetchMilestoneDates(): Promise<MilestoneDates | null> {
  try {
    return readMilestoneDates(await coachGet<unknown>('/api/coach/gamification/my-points'));
  } catch {
    return null;
  }
}
