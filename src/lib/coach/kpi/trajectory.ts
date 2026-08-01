/**
 * KPI trajectory — pure shaping of the frozen monthly kpi_snapshot rows into a per-metric month-over-month
 * series (§3.6 "make learning visible"). PURE + unit-tested, mirroring compute.ts: no IO, no direction
 * judgement (whether a rise is "good" is metric-specific and belongs to the UI, which knows each metric's
 * polarity). The reader route feeds this the rows; this groups + orders + computes the honest delta.
 *
 * §3.4 honesty is structural here: a trend from a single month is a fabricated line, so `building` is true
 * until at least MIN_MONTHS_FOR_TRAJECTORY distinct months exist, and `delta` is null unless there are two
 * real (non-null) values to compare — never a guess.
 */

import { round1 } from "./compute";

/** A trend needs at least this many months to mean anything; below it the UI shows a "building" state. */
export const MIN_MONTHS_FOR_TRAJECTORY = 2;

export type TrajectorySnapshotRow = {
  metric: string;
  layer: number;
  value: number | null;
  period: string; // 'YYYY-MM'
  sampleSize: number;
};

export type TrajectoryPoint = { period: string; value: number | null; sampleSize: number };

export type MetricTrajectory = {
  metric: string;
  layer: number;
  points: TrajectoryPoint[]; // chronological (period ascending)
  latest: number | null; // most recent NON-NULL value
  previous: number | null; // the non-null value immediately before `latest`
  delta: number | null; // latest - previous, or null unless BOTH exist
  monthsWithData: number; // count of points whose value is non-null
};

export type Trajectory = {
  building: boolean; // true when < MIN_MONTHS_FOR_TRAJECTORY distinct months are present at all
  monthsCovered: number; // distinct periods present (regardless of value)
  metrics: MetricTrajectory[];
};

/**
 * Group frozen monthly rows into per-metric chronological series + honest month-over-month deltas.
 * Input rows may arrive in any order and may contain null values ("building" months); output points are
 * period-ascending and the delta compares the two most recent NON-NULL values.
 */
export function buildTrajectory(rows: TrajectorySnapshotRow[]): Trajectory {
  const distinctPeriods = new Set(rows.map((r) => r.period));
  const monthsCovered = distinctPeriods.size;

  const byMetric = new Map<string, { layer: number; rows: TrajectorySnapshotRow[] }>();
  for (const r of rows) {
    const entry = byMetric.get(r.metric) ?? { layer: r.layer, rows: [] };
    entry.rows.push(r);
    byMetric.set(r.metric, entry);
  }

  const metrics: MetricTrajectory[] = [];
  for (const [metric, { layer, rows: mrows }] of byMetric) {
    // Chronological by period string. 'YYYY-MM' sorts lexicographically == chronologically.
    const points: TrajectoryPoint[] = [...mrows]
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
      .map((r) => ({ period: r.period, value: r.value, sampleSize: r.sampleSize }));

    const nonNull = points.filter((p) => p.value !== null);
    const latest = nonNull.length >= 1 ? (nonNull[nonNull.length - 1]!.value as number) : null;
    const previous = nonNull.length >= 2 ? (nonNull[nonNull.length - 2]!.value as number) : null;
    const delta = latest !== null && previous !== null ? round1(latest - previous) : null;

    metrics.push({ metric, layer, points, latest, previous, delta, monthsWithData: nonNull.length });
  }

  // Stable order: by layer, then metric name — matches how the KPI page groups its layers.
  metrics.sort((a, b) => a.layer - b.layer || (a.metric < b.metric ? -1 : a.metric > b.metric ? 1 : 0));

  return {
    building: monthsCovered < MIN_MONTHS_FOR_TRAJECTORY,
    monthsCovered,
    metrics,
  };
}
