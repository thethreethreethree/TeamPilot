/**
 * Shared Today's-Metrics period helpers (Macro Mode, founder spec 2026-08-19). Pure so the windowing + the
 * score aggregation are unit-tested independently of the DB.
 */

export const TODAYS_METRICS_PERIODS = ["day", "week", "month", "all_time"] as const;
export type MetricsPeriod = (typeof TODAYS_METRICS_PERIODS)[number];

export function isMetricsPeriod(p: string): p is MetricsPeriod {
  return (TODAYS_METRICS_PERIODS as readonly string[]).includes(p);
}

/**
 * The inclusive local_date lower bound (YYYY-MM-DD) for a rolling period ending on `todayIso`, or null for
 * all_time (no lower bound). day = today, week = 6 days back, month = 29 days back — the SAME windows the macro
 * rollup uses, so Today's Metrics and the Report Card patterns describe the same set of doors.
 */
export function periodStartLocal(period: MetricsPeriod, todayIso: string): string | null {
  if (period === "all_time") return null;
  const days = period === "day" ? 0 : period === "week" ? 6 : 29;
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Average each score dimension across a period's pitches (rounded to a whole number). A dimension absent from a
 * given pitch is skipped — so a period that mixes v1 (opener/objection/tone/close) and v2 (objection/talk_listen/
 * questions/tone/close) pitches averages each dim over exactly the pitches that carry it, never diluting with 0s.
 * Returns {} when there is nothing to average (the caller shows an honest "not enough scored pitches yet").
 */
export function averageScores(list: Array<Record<string, number>>): Record<string, number> {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const scores of list) {
    for (const [dim, val] of Object.entries(scores)) {
      if (typeof val !== "number" || Number.isNaN(val)) continue;
      sums[dim] = (sums[dim] ?? 0) + val;
      counts[dim] = (counts[dim] ?? 0) + 1;
    }
  }
  const avg: Record<string, number> = {};
  for (const dim of Object.keys(sums)) {
    const sum = sums[dim] ?? 0;
    const count = counts[dim] ?? 1;
    avg[dim] = Math.round(sum / count);
  }
  return avg;
}
