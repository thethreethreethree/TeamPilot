import { describe, it, expect } from "vitest";
import { buildUsage, mergeSignIns } from "../usage";

const NOW = Date.parse("2026-11-23T12:00:00Z");
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("buildUsage", () => {
  const members = [{ id: "b", name: "Bea" }, { id: "a", name: "Ana" }, { id: "c", name: "Cal" }];
  const u = buildUsage(
    members,
    [
      { personId: "a", kind: "calls", at: ago(1) },
      { personId: "a", kind: "calls", at: ago(10) },
      { personId: "a", kind: "signIns", at: ago(2) },
      { personId: "b", kind: "questions", at: ago(20) },
      { personId: "b", kind: "practice", at: ago(40) }, // outside 30 days
      { personId: "x", kind: "calls", at: ago(1) }, // not a visible member
      { personId: "c", kind: "pipeline", at: new Date(NOW + 3_600_000).toISOString() }, // in the future: ignored
    ],
    NOW,
  );
  it("rows are alphabetical — usage, not a ranking", () => {
    expect(u.rows.map((r) => r.name)).toEqual(["Ana", "Bea", "Cal"]);
  });
  it("counts per window; events outside 30 days, for someone not visible, or in the future are ignored", () => {
    expect(u.rows[0]).toMatchObject({ last7: { calls: 1, signIns: 1 }, last30: { calls: 2, signIns: 1 }, lastActive: ago(1) });
    expect(u.rows[1]).toMatchObject({ last7: { questions: 0 }, last30: { questions: 1, practice: 0 } });
    expect(u.rows[2]!.lastActive).toBeNull();
  });
  it("active people per window and totals", () => {
    expect(u).toMatchObject({ people: 3, active7: 1, active30: 2 });
    expect(u.totals30).toEqual({ signIns: 1, calls: 2, questions: 1, practice: 0, pipeline: 0 });
  });
});

describe("mergeSignIns (0327)", () => {
  it("a web sign-in recorded by the form and by its session counts once; a session alone and a form record alone each count", () => {
    const t = (min: number) => new Date(Date.UTC(2026, 10, 20, 10, min)).toISOString();
    const out = mergeSignIns([
      { userId: "a", at: t(0), source: "password" },
      { userId: "a", at: t(1), source: "session" }, // same sign-in (1 min apart)
      { userId: "a", at: t(30), source: "session" }, // mobile app: no form record
      { userId: "a", at: t(60), source: "password" }, // its session was signed out (removed)
      { userId: "b", at: t(0), source: "session" },
    ]);
    expect(out.filter((x) => x.personId === "a")).toHaveLength(3);
    expect(out.filter((x) => x.personId === "b")).toHaveLength(1);
  });
});

describe("time on calls (F10.7)", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  const at = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
  const u = buildUsage(
    [{ id: "a", name: "Ana" }],
    [
      { personId: "a", kind: "calls", at: at(1), seconds: 600 },
      { personId: "a", kind: "calls", at: at(2), seconds: null }, // unknown length: counted as a call, not as time
      { personId: "a", kind: "calls", at: at(10), seconds: 1200 },
      { personId: "a", kind: "questions", at: at(1), seconds: 999 }, // only calls carry time
    ],
    now,
  );
  const a = u.rows[0]!;
  it("adds known call lengths per window and counts how many were known", () => {
    expect(a.last7.calls).toBe(2);
    expect(a.time7).toEqual({ seconds: 600, timed: 1 });
    expect(a.time30).toEqual({ seconds: 1800, timed: 2 });
  });
  it("a person with no calls has zero time, not a guess", () => {
    const v = buildUsage([{ id: "b", name: "Bo" }], [], now).rows[0]!;
    expect(v.time30).toEqual({ seconds: 0, timed: 0 });
  });
});

describe("buildUsage — connect rate (F25.8)", () => {
  it("counts calls with an outcome, and those that reached someone, per window; unjudged calls are left out", async () => {
    const { buildUsage } = await import("../usage");
    const now = Date.parse("2026-11-26T12:00:00Z");
    const at = (d: number) => new Date(now - d * 86_400_000).toISOString();
    const out = buildUsage([{ id: "a", name: "Ana" }], [
      { personId: "a", kind: "calls", at: at(1), connected: true },
      { personId: "a", kind: "calls", at: at(2), connected: false },
      { personId: "a", kind: "calls", at: at(3), connected: null }, // no outcome yet
      { personId: "a", kind: "calls", at: at(20), connected: true }, // outside 7 days
      { personId: "a", kind: "signIns", at: at(1) },
    ], now);
    expect(out.rows[0]!.reached7).toEqual({ reached: 1, withOutcome: 2 });
    expect(out.rows[0]!.reached30).toEqual({ reached: 2, withOutcome: 3 });
    expect(out.rows[0]!.last7.calls).toBe(3);
  });
});
