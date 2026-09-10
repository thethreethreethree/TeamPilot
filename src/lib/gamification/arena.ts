/**
 * The rep's own Arena — the derived figures behind My Progress (spec 5.2).
 *
 * EVERYTHING HERE IS DERIVED FROM THE LEDGER the rep already owns. Nothing is
 * computed that the server does not also know, and the points formula is NOT
 * reimplemented — points arrive banked, and this only counts and sorts them.
 *
 * A BADGE IS EARNED OR IT IS NOT. There is no partial state and no progress bar
 * toward one, because a bar implies the app knows how close somebody is to
 * something it has not measured. `sessions >= 1` is a fact; "80% of the way to
 * your first deal" is a fiction.
 *
 * NOTHING IS FABRICATED WHEN THERE IS NO DATA. A rep with no scored session gets
 * a null average and a null band, never a zero and never "Needs coaching" — the
 * distinction the whole build spec turns on (§0.5: "never fabricate a rank, a
 * band, or a trust verdict with no data behind it").
 */
import { bandFor, STRONG_SESSION_POINTS, type PointRow } from './points';

/**
 * The five badges, named the way the SERVER names them.
 *
 * These keys were 'first-pitch' / 'strong' / 'first-deal' here and
 * spark / flame / deal on the route, which meant the earned-DATES the route
 * sends could not be matched to the badges without a translation table nobody
 * would remember to update. The replication spec says mirror the web rather
 * than re-derive it, and a second vocabulary for the same five things is
 * exactly the kind of re-derivation that goes wrong quietly. One name each.
 */
export const MILESTONE_KEYS = ['spark', 'flame', 'deal', 'century', 'closer'] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export type Milestone = {
  key: MilestoneKey;
  label: string;
  /** What earning it takes, in the rep's own words. Shown whether or not it is earned. */
  requirement: string;
  /**
   * NULL when it cannot be judged.
   *
   * The deal badges depend on a count that comes from the team board, and that
   * board can fail to load. Reporting `false` then tells a rep with twelve deals
   * that they have not closed one — a definite statement built on a missing
   * number. Null renders as "can't tell right now", which is what is true.
   */
  earned: boolean | null;
};

export type BestPitch = {
  sessionId: string;
  points: number;
  at: string;
  /** Spec 5.2: a pitch under seven days old is flagged NEW. */
  isNew: boolean;
  /**
   * The band this pitch fell in, which spec §2 asks for beside the date and
   * which the list was missing.
   *
   * WHY IT MATTERS MORE THAN IT LOOKS. "87 points" is only readable by somebody
   * who already knows the scale runs to 100 and where the boundaries sit. "87
   * points · Elite" is readable by the rep it is about. A record list whose
   * records need a key is a list nobody reads twice.
   *
   * DERIVED FROM THE FOLDED TOTAL, NOT TAKEN FROM THE ROW — and the difference
   * matters, so it is written down before somebody "fixes" it.
   *
   * `PointRow` already carries a `band` from the server, which looks like the
   * obvious source and is the wrong one. `bySession` SUMS every row for a
   * session, because a correction weeks later still moved that session's score.
   * The row's band is the band of THAT ROW: a session scored 85 ("strong") with
   * a +6 correction displays 91, and taking the row's band would print "Strong"
   * beside the number 91. Deriving from the folded total is the only way the
   * label agrees with the figure sitting next to it.
   *
   * And derived through `bandFor`, never re-implemented — the spec's checklist
   * asks for one module holding the band constants, and the reason is the defect
   * that turned up on the web today: two places rounding differently put the
   * same score in two different bands on two different screens.
   *
   * Null when the points cannot be banded, which `bandFor` already answers
   * safely for a null or non-finite input.
   */
  band: string | null;
};

export type Arena = {
  /** Points per session, corrections folded in. */
  sessions: number;
  total: number;
  /** null when nothing has been scored — never 0. */
  average: number | null;
  /** The band of the AVERAGE, or null when there is nothing to band. */
  band: string | null;
  best: number | null;
  strongSessions: number;
  bestPitches: BestPitch[];
  /** Oldest first, for a chart that reads left to right. */
  lastSeven: { sessionId: string; points: number; at: string }[];
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fold the ledger into per-session totals.
 *
 * A CORRECTION IS NOT ITS OWN SESSION. Corrections are negative rows against a
 * session already banked; counted separately they would show a rep a phantom
 * session worth -12 points that never happened to them.
 */
function bySession(rows: PointRow[]): Map<string, { points: number; at: string }> {
  const out = new Map<string, { points: number; at: string }>();
  for (const r of rows) {
    if (!r.sessionId || !Number.isFinite(r.points)) continue;
    const held = out.get(r.sessionId);
    if (held) {
      held.points += r.points;
      // Keep the EARLIEST timestamp: the session happened when it happened, not
      // when somebody corrected it weeks later.
      if (r.createdAt && r.createdAt < held.at) held.at = r.createdAt;
    } else {
      out.set(r.sessionId, { points: r.points, at: r.createdAt });
    }
  }
  return out;
}

export function buildArena(
  rows: PointRow[],
  /** `deals` is null when the team board could not be read — never 0. */
  opts: { deals: number | null; now: number },
): Arena {
  const folded = bySession(rows);
  const entries = [...folded.entries()]
    .map(([sessionId, v]) => ({ sessionId, points: v.points, at: v.at }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const sessions = entries.length;
  // The TOTAL includes every ledger row, session-bound or not: a manual
  // correction with no session still moved the rep's total, and hiding it would
  // make the figure disagree with the scoreboard.
  const total = rows.reduce((n, r) => (Number.isFinite(r.points) ? n + r.points : n), 0);
  const average = sessions === 0 ? null : Math.round((entries.reduce((n, e) => n + e.points, 0) / sessions) * 10) / 10;
  const best = sessions === 0 ? null : Math.max(...entries.map((e) => e.points));
  const strongSessions = entries.filter((e) => e.points >= STRONG_SESSION_POINTS).length;

  const bestPitches = [...entries]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((e) => ({
      sessionId: e.sessionId,
      points: e.points,
      at: e.at,
      isNew: isRecent(e.at, opts.now),
      band: bandFor(e.points),
    }));

  return {
    sessions,
    total,
    average,
    band: bandFor(average),
    best,
    strongSessions,
    bestPitches,
    lastSeven: entries.slice(-7),
  };
}

function isRecent(at: string, now: number): boolean {
  const t = Date.parse(at);
  // An unparseable date is not "new". Guessing would put a NEW flag on a pitch
  // from last year.
  if (!Number.isFinite(t)) return false;
  // Strictly LESS than seven days, as the spec words it. At exactly seven the
  // flag drops — an inclusive check keeps it on for a whole extra day.
  return now - t < SEVEN_DAYS_MS;
}

/**
 * The milestone badges, spec 5.2.
 *
 * Every badge is listed whether earned or not, with what it takes — an unearned
 * badge a rep cannot see the condition for is just a locked box.
 */
export function milestones(arena: Arena, deals: number | null): Milestone[] {
  return [
    {
      key: 'spark',
      label: 'First pitch',
      requirement: 'Record and score one call',
      earned: arena.sessions >= 1,
    },
    {
      key: 'flame',
      label: 'Strong',
      requirement: `Score ${STRONG_SESSION_POINTS} or more on a call`,
      earned: arena.strongSessions >= 1,
    },
    {
      key: 'deal',
      label: 'First deal',
      requirement: 'Close one',
      // null, not false: an unreadable deal count cannot disprove a deal.
      earned: deals === null ? null : deals >= 1,
    },
    {
      key: 'century',
      label: 'Century',
      requirement: '100 scored calls',
      earned: arena.sessions >= 100,
    },
    {
      key: 'closer',
      label: 'Closer',
      requirement: '10 deals closed',
      earned: deals === null ? null : deals >= 10,
    },
  ];
}
