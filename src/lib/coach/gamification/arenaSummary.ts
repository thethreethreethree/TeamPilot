import { BANDS, BAND_LABEL, STRONG_SESSION_THRESHOLD, bandFor, type PointsBand } from "./bands";
import { MILESTONE_TITLES, type MilestoneKey, type MilestoneDates } from "./milestones";

/**
 * deriveArena — the PURE derivation behind the rep's Arena UI (RepArena.tsx). Given the rep's own points history
 * (my-points) and their leaderboard row (best/deals) + rank, compute everything the view renders: the gauge band,
 * strong-session count, best-pitch records, milestone on/off, and the recent bars. No I/O, no React — so the branchy
 * bits (leaderboard-missing fallbacks, milestone thresholds, top-3 / last-7 windows) are gate-able by test (A30).
 */

export interface ArenaRow {
  session_id: string | null;
  points: number;
  band: string | null;
  created_at: string;
}
export interface ArenaInput {
  rows: ArenaRow[]; // oldest -> newest (as my-points returns them)
  total: number;
  avg: number;
  sessions: number;
  best: number | null; // from the leaderboard row; null when the board didn't load
  deals: number | null;
  rank: number | null;
  // strong-session count over the FULL history (from my-points). Falls back to counting the passed `rows` when
  // absent — but `rows` may be a truncated recent window, so the server-computed value is the correct one.
  strong?: number | null;
  // Milestone earned-at dates, DERIVED server-side from the full history (GAM-R13). When present, a milestone's
  // earnedAt is its truthful date; `on` still gates display (they agree — both read the same full-history counts).
  milestones?: Partial<MilestoneDates>;
  nowMs?: number; // injectable for tests; defaults to Date.now()
}

export interface ArenaMilestone {
  key: MilestoneKey;
  on: boolean;
  title: string;
  earnedAt: string | null; // ISO date the milestone was first earned (from the immutable ledger), or null
}
export interface ArenaRecord {
  row: ArenaRow;
  band: PointsBand;
  bandLabel: string;
  isNew: boolean; // scored within the last 7 days
  floor: number; // the band's lower bound (for the "N+" chip)
}
export interface ArenaSummary {
  band: PointsBand;
  bandLabel: string;
  best: number;
  deals: number;
  rank: number | null;
  strong: number;
  records: ArenaRecord[];
  bars: ArenaRow[];
  milestones: ArenaMilestone[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function deriveArena(input: ArenaInput): ArenaSummary {
  const { rows } = input;
  const now = input.nowMs ?? Date.now();

  // best/deals fall back to the rep's own history when the leaderboard row is absent (board didn't load).
  const best = input.best ?? (rows.length ? Math.max(...rows.map((r) => r.points)) : 0);
  const deals = input.deals ?? 0;
  // Prefer the server-computed full-history count; only fall back to the (possibly truncated) rows when absent.
  const strong = input.strong ?? rows.filter((r) => r.points >= STRONG_SESSION_THRESHOLD).length;
  const band = bandFor(input.avg);

  const records: ArenaRecord[] = [...rows]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((row) => {
      const b = bandFor(row.points);
      return {
        row,
        band: b,
        bandLabel: BAND_LABEL[b],
        isNew: new Date(row.created_at).getTime() >= now - WEEK_MS,
        floor: BANDS.find((x) => x.band === b)?.min ?? 0,
      };
    });

  const bars = rows.slice(-7);

  const md = input.milestones ?? {};
  const milestone = (key: MilestoneKey, on: boolean): ArenaMilestone => ({
    key,
    on,
    title: MILESTONE_TITLES[key],
    earnedAt: md[key] ?? null,
  });
  const milestones: ArenaMilestone[] = [
    milestone("spark", input.sessions >= 1),
    milestone("flame", strong >= 1),
    milestone("deal", deals >= 1),
    milestone("century", input.sessions >= 100),
    milestone("closer", deals >= 10),
  ];

  return { band, bandLabel: BAND_LABEL[band], best, deals, rank: input.rank, strong, records, bars, milestones };
}
