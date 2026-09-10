/**
 * The rep's own points, worked out from an APPEND-ONLY ledger.
 *
 * That one property drives every rule here. Migration 0242 makes the ledger
 * immutable with a raising trigger: a correction is never an edit, it is a NEW
 * row carrying negative points that offsets an earlier one. So:
 *
 *   TOTAL is the sum, negatives included. Never a max, never the latest row.
 *
 *   SESSIONS counts DISTINCT session ids, not rows. Counting rows is the
 *   obvious version and it is wrong the moment anybody is corrected: a single
 *   session with a score and a correction becomes "2 sessions", which inflates
 *   the count a rep sees and DEFLATES their average — so being corrected once
 *   would appear to drag down an average that has nothing to do with it.
 *
 *   A CORRECTION IS NOT A SESSION. Rows with a null session_id (a manual
 *   adjustment) count towards the total and towards nothing else.
 *
 * NO WRITE PATH EXISTS HERE, deliberately. The table has no insert policy at
 * all — the ledger is written by service-role code. The phone reads and only
 * reads, which is also why nothing here needs the backend branch deployed.
 */

export type PointRow = {
  sessionId: string | null;
  points: number;
  band: string | null;
  createdAt: string;
};

export type PointsSummary = {
  /** Sum of every row, corrections included. */
  total: number;
  /** Distinct sessions that have banked points. */
  sessions: number;
  /** Points per session, or null when there are none — never a zero. */
  average: number | null;
};

export const BAND_LABEL: Record<string, string> = {
  elite: 'Elite',
  strong: 'Strong',
  solid: 'Solid',
  developing: 'Developing',
  needs_coaching: 'Needs coaching',
};

/** A band the phone does not recognise is shown as itself, never dropped. */
export function bandLabel(band: string | null): string | null {
  if (!band) return null;
  return BAND_LABEL[band] ?? band;
}

export function summarise(rows: PointRow[]): PointsSummary {
  let total = 0;
  const sessions = new Set<string>();
  for (const r of rows) {
    if (!Number.isFinite(r.points)) continue;
    total += r.points;
    if (r.sessionId) sessions.add(r.sessionId);
  }
  const n = sessions.size;
  return {
    total,
    sessions: n,
    // An em dash on screen, never a 0 — see home-view.ts for the same rule.
    average: n === 0 ? null : Math.round((total / n) * 10) / 10,
  };
}

/**
 * Points per session for the trend, oldest first.
 *
 * One entry per SESSION, with its corrections already folded in, because a
 * chart that plotted a correction as its own point would show a rep a sudden
 * dive to a negative number that never happened to them.
 */
export function trendPoints(rows: PointRow[]): { sessionId: string; points: number; at: string }[] {
  const bySession = new Map<string, { points: number; at: string }>();
  for (const r of rows) {
    if (!r.sessionId || !Number.isFinite(r.points)) continue;
    const held = bySession.get(r.sessionId);
    if (held) {
      held.points += r.points;
      // The session is placed by when it FIRST banked, so a correction months
      // later does not jump an old session to the end of the chart.
      if (r.createdAt < held.at) held.at = r.createdAt;
    } else {
      bySession.set(r.sessionId, { points: r.points, at: r.createdAt });
    }
  }
  return [...bySession.entries()]
    .map(([sessionId, v]) => ({ sessionId, points: v.points, at: v.at }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * The band boundaries, mirroring section 1 of the mobile build spec.
 *
 * ONE PLACE, and this module is it. The spec is explicit: "never re-implement
 * the band boundaries or the points formula in a second place". Every screen
 * reads the stored `detail.band` where there is one — this exists for the cases
 * where there is not, and so the boundaries are written down once rather than
 * scattered as magic numbers through a component.
 *
 * THE POINTS FORMULA IS NOT HERE, deliberately. Points are banked server-side
 * from the after-pitch dimension scores; the phone never computes them. A second
 * implementation could only ever drift from the first, and the drift would show
 * a rep a different total from the one the website shows them.
 */
export const BANDS = [
  { band: 'elite', min: 90, max: 100 },
  { band: 'strong', min: 80, max: 89 },
  { band: 'solid', min: 60, max: 79 },
  { band: 'developing', min: 40, max: 59 },
  { band: 'needs_coaching', min: 0, max: 39 },
] as const;

/** The threshold that fires the manager's "strong session" alert. */
export const STRONG_SESSION_POINTS = 80;

/**
 * The band a score falls in, or null when there is no score.
 *
 * NULL, NEVER 'needs_coaching', for an absent value. A rep with no scored
 * session has not been judged badly — they have not been judged. This is the
 * same rule the skills grade already follows, where an unmeasured skill draws no
 * letter rather than a D.
 */
export function bandFor(points: number | null | undefined): string | null {
  if (typeof points !== 'number' || !Number.isFinite(points)) return null;
  const p = Math.round(points);
  const hit = BANDS.find((b) => p >= b.min && p <= b.max);
  if (hit) return hit.band;
  // Outside 0-100 entirely: clamp to the end it ran past rather than invent a
  // band. A negative total is a corrected rep, not a new category.
  return p > 100 ? 'elite' : 'needs_coaching';
}
