/**
 * Team call stats (2026-11-25; Gong ledger F10.9 "Team page controls": a team-level stats page with a period). Per rep
 * over a window of their phone/video calls: how many calls, and the average of each interaction stat (0277), counting
 * only the calls where that stat could be measured — a null means "not measurable on this call", never zero. One
 * stats row per call: its latest transcript version. A team row averages over every call, not over reps, so a rep with
 * one call doesn't weigh the same as one with forty. Rows alphabetical: these are the team's own norms, not a ranking
 * and never a Gong benchmark (docs/04). Pure.
 */
export type StatRow = {
  sessionId: string;
  repId: string;
  version: number;
  talkRatioTime: number | null;
  longestRepMonologueMs: number | null;
  longestCustomerStoryMs: number | null;
  interactivity: number | null;
  patienceMs: number | null;
  repQuestionsPerHour: number | null;
};
export const STAT_KEYS = ["talkRatioTime", "longestRepMonologueMs", "longestCustomerStoryMs", "interactivity", "patienceMs", "repQuestionsPerHour"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Averages = Record<StatKey, number | null> & { calls: number };
export type RepStats = Averages & { repId: string; name: string };

function average(rows: StatRow[]): Averages {
  const out = { calls: rows.length } as Averages;
  for (const k of STAT_KEYS) {
    const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    out[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return out;
}

export function teamCallStats(rows: StatRow[], names: Map<string, string>): { reps: RepStats[]; team: Averages } {
  const latest = new Map<string, StatRow>();
  for (const r of rows) {
    const had = latest.get(r.sessionId);
    if (!had || r.version > had.version) latest.set(r.sessionId, r);
  }
  const calls = [...latest.values()];
  const byRep = new Map<string, StatRow[]>();
  for (const c of calls) byRep.set(c.repId, [...(byRep.get(c.repId) ?? []), c]);
  const reps = [...byRep.entries()]
    .map(([repId, rs]) => ({ repId, name: names.get(repId) ?? "Unnamed teammate", ...average(rs) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { reps, team: average(calls) };
}
