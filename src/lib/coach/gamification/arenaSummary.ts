import { BANDS, BAND_LABEL, STRONG_SESSION_THRESHOLD, bandFor, type PointsBand } from "./bands";

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
  nowMs?: number; // injectable for tests; defaults to Date.now()
}

export interface ArenaMilestone {
  key: "spark" | "flame" | "deal" | "century" | "closer";
  on: boolean;
  title: string;
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
  const strong = rows.filter((r) => r.points >= STRONG_SESSION_THRESHOLD).length;
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

  const milestones: ArenaMilestone[] = [
    { key: "spark", on: input.sessions >= 1, title: "First pitch scored" },
    { key: "flame", on: strong >= 1, title: "A strong session (80+)" },
    { key: "deal", on: deals >= 1, title: "First deal closed" },
    { key: "century", on: input.sessions >= 100, title: "100 sessions" },
    { key: "closer", on: deals >= 10, title: "10 deals — Closer" },
  ];

  return { band, bandLabel: BAND_LABEL[band], best, deals, rank: input.rank, strong, records, bars, milestones };
}
