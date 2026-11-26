/**
 * Interaction alerts on calls not yet coached (2026-11-26, Gong ledger F16.6 "filter recorded calls … interaction
 * alerts"). A call is flagged when one of its interaction stats is further out than 9 in 10 of THIS TEAM's analyzed
 * calls — the rep talked more, held the floor longer, the call was less of a back-and-forth, or the rep cut in faster.
 *
 * HONESTY (§3.4): there is no fixed "good" line. The cut is the team's own 90th (or 10th) percentile, and below
 * MIN_BASELINE analyzed calls there is no cut at all — the panel says how many more calls it needs. An alert is
 * "unusual for this team", never "wrong". Pure, so the arithmetic is tested.
 */
export const MIN_BASELINE = 20;

export type Stats = {
  talkRatio: number | null; // rep's share of talk time, 0–1
  longestMonologueMs: number | null;
  interactivity: number | null; // 0–10
  patienceMs: number | null; // pause before the rep answers
};
export type AlertKind = "talked_most" | "long_monologue" | "little_back_and_forth" | "quick_to_answer";
export const ALERT_WORDS: Record<AlertKind, string> = {
  talked_most: "Rep talked more than in 9 of 10 team calls",
  long_monologue: "Longest monologue longer than in 9 of 10 team calls",
  little_back_and_forth: "Less back-and-forth than 9 of 10 team calls",
  quick_to_answer: "Rep answered faster than in 9 of 10 team calls",
};

/** Nearest-rank percentile of the non-null values; null when there are fewer than MIN_BASELINE. */
function cut(values: Array<number | null>, p: number): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < MIN_BASELINE) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))]!;
}

export type Baseline = { calls: number; cuts: Record<AlertKind, number | null> };
export function baselineFrom(team: Stats[]): Baseline {
  return {
    calls: team.length,
    cuts: {
      talked_most: cut(team.map((s) => s.talkRatio), 0.9),
      long_monologue: cut(team.map((s) => s.longestMonologueMs), 0.9),
      little_back_and_forth: cut(team.map((s) => s.interactivity), 0.1),
      quick_to_answer: cut(team.map((s) => s.patienceMs), 0.1),
    },
  };
}

/** Strictly beyond the cut, so a team where every call is alike flags none. */
export function alertsFor(s: Stats | undefined, b: Baseline): AlertKind[] {
  if (!s) return [];
  const out: AlertKind[] = [];
  const { cuts } = b;
  if (cuts.talked_most !== null && s.talkRatio !== null && s.talkRatio > cuts.talked_most) out.push("talked_most");
  if (cuts.long_monologue !== null && s.longestMonologueMs !== null && s.longestMonologueMs > cuts.long_monologue) out.push("long_monologue");
  if (cuts.little_back_and_forth !== null && s.interactivity !== null && s.interactivity < cuts.little_back_and_forth) out.push("little_back_and_forth");
  if (cuts.quick_to_answer !== null && s.patienceMs !== null && s.patienceMs < cuts.quick_to_answer) out.push("quick_to_answer");
  return out;
}
