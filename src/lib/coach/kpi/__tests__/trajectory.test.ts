import { describe, expect, it } from "vitest";
import { buildTrajectory, MIN_MONTHS_FOR_TRAJECTORY, type TrajectorySnapshotRow } from "../trajectory";

const row = (metric: string, layer: number, value: number | null, period: string, n = value === null ? 0 : 8): TrajectorySnapshotRow => ({
  metric,
  layer,
  value,
  period,
  sampleSize: n,
});

describe("buildTrajectory (§3.6 monthly KPI series)", () => {
  it("is BUILDING with a single month (no fabricated trend from one point)", () => {
    const t = buildTrajectory([row("conversionRate", 1, 42, "2026-07")]);
    expect(t.building).toBe(true);
    expect(t.monthsCovered).toBe(1);
    // The one metric still surfaces its point, but delta is null (nothing to compare).
    expect(t.metrics[0]!.delta).toBeNull();
    expect(t.metrics[0]!.latest).toBe(42);
    expect(t.metrics[0]!.previous).toBeNull();
  });

  it("is NOT building once MIN_MONTHS distinct months exist", () => {
    const t = buildTrajectory([
      row("conversionRate", 1, 40, "2026-07"),
      row("conversionRate", 1, 46, "2026-08"),
    ]);
    expect(MIN_MONTHS_FOR_TRAJECTORY).toBe(2);
    expect(t.building).toBe(false);
    expect(t.monthsCovered).toBe(2);
  });

  it("computes delta = latest − previous from the two most recent NON-NULL values", () => {
    const t = buildTrajectory([
      row("conversionRate", 1, 40, "2026-07"),
      row("conversionRate", 1, 46.5, "2026-08"),
    ]);
    expect(t.metrics[0]!.latest).toBe(46.5);
    expect(t.metrics[0]!.previous).toBe(40);
    expect(t.metrics[0]!.delta).toBe(6.5);
  });

  it("skips NULL ('building') months when picking the two values to compare, but keeps them in points", () => {
    const t = buildTrajectory([
      row("conversionRate", 1, 30, "2026-06"),
      row("conversionRate", 1, null, "2026-07"), // a month below MIN_SESSIONS → gated null
      row("conversionRate", 1, 48, "2026-08"),
    ]);
    // delta compares 48 (Aug) vs 30 (Jun) — the null July is skipped for the comparison...
    expect(t.metrics[0]!.delta).toBe(18);
    // ...but the null month is still present in the series (so the sparkline shows the gap honestly).
    expect(t.metrics[0]!.points).toHaveLength(3);
    expect(t.metrics[0]!.points[1]!.value).toBeNull();
    expect(t.metrics[0]!.monthsWithData).toBe(2);
  });

  it("orders points chronologically even when rows arrive unordered", () => {
    const t = buildTrajectory([
      row("closeRate", 1, 50, "2026-08"),
      row("closeRate", 1, 40, "2026-06"),
      row("closeRate", 1, 45, "2026-07"),
    ]);
    expect(t.metrics[0]!.points.map((p) => p.period)).toEqual(["2026-06", "2026-07", "2026-08"]);
    // latest is the chronologically-last value, not the input-last.
    expect(t.metrics[0]!.latest).toBe(50);
  });

  it("groups by metric and orders metrics by layer then name", () => {
    const t = buildTrajectory([
      row("sessionsPerDay", 2, 3, "2026-07"),
      row("conversionRate", 1, 40, "2026-07"),
      row("avgDealSize", 1, 1000, "2026-07"),
    ]);
    expect(t.metrics.map((m) => m.metric)).toEqual(["avgDealSize", "conversionRate", "sessionsPerDay"]);
    expect(t.metrics.map((m) => m.layer)).toEqual([1, 1, 2]);
  });

  it("delta stays null with only one non-null value across months (honest gate)", () => {
    const t = buildTrajectory([
      row("revenue", 1, null, "2026-07"),
      row("revenue", 1, 5000, "2026-08"),
    ]);
    expect(t.building).toBe(false); // 2 months exist...
    expect(t.metrics[0]!.delta).toBeNull(); // ...but only 1 has a real value → no delta
    expect(t.metrics[0]!.latest).toBe(5000);
  });
});
