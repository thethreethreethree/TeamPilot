import { describe, it, expect } from "vitest";
import { computeAdoption, weekOf } from "../adoption";

describe("computeAdoption", () => {
  const created = "2026-11-02T00:00:00Z";
  const calls = [
    { sessionId: "old", repId: "a", startedAt: "2026-10-30T10:00:00Z", version: 1 }, // before the tracker: never counted
    { sessionId: "s1", repId: "a", startedAt: "2026-11-03T10:00:00Z", version: 1 },
    { sessionId: "s2", repId: "a", startedAt: "2026-11-04T10:00:00Z", version: 2 },
    { sessionId: "s3", repId: "b", startedAt: "2026-11-10T10:00:00Z", version: 1 },
  ];
  const hits = [
    { sessionId: "old", version: 1 }, // a backfilled hit on an uncounted call
    { sessionId: "s1", version: 1 },
    { sessionId: "s2", version: 1 }, // only an OLDER version said it — the current one (2) doesn't
    { sessionId: "s3", version: 1 },
  ];
  const r = computeAdoption(created, calls, hits);
  it("counts only calls since the tracker started listening, on their current transcript", () => {
    expect(r).toMatchObject({ calls: 3, said: 2 });
    expect(r.rate).toBeCloseTo(2 / 3);
  });
  it("per rep and per week (Monday-start)", () => {
    expect(r.reps).toEqual(expect.arrayContaining([{ repId: "a", calls: 2, said: 1, rate: 0.5 }, { repId: "b", calls: 1, said: 1, rate: 1 }]));
    expect(r.weeks).toEqual([
      { weekStart: "2026-11-02", calls: 2, said: 1, rate: 0.5 },
      { weekStart: "2026-11-09", calls: 1, said: 1, rate: 1 },
    ]);
  });
  it("no calls → no rate (not 0%)", () => {
    expect(computeAdoption(created, [], []).rate).toBeNull();
  });
  it("weekOf is the Monday on or before", () => {
    expect(weekOf("2026-11-08T23:00:00Z")).toBe("2026-11-02"); // Sunday
    expect(weekOf("2026-11-09T00:30:00Z")).toBe("2026-11-09");
  });
});
