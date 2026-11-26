import { describe, it, expect } from "vitest";
import { alertsFor, baselineFrom, MIN_BASELINE, type Stats } from "../interactionAlerts";

/** F16.6 (2026-11-26): interaction alerts are "further out than 9 in 10 of this team's calls", and need a baseline. */
const s = (i: number): Stats => ({ talkRatio: i / 100, longestMonologueMs: i * 1000, interactivity: i / 10, patienceMs: i * 10 });
const team = Array.from({ length: 30 }, (_, i) => s(i + 1)); // 1..30

describe("interaction alerts", () => {
  it("no cut below the minimum baseline", () => {
    const b = baselineFrom(team.slice(0, MIN_BASELINE - 1));
    expect(Object.values(b.cuts).every((c) => c === null)).toBe(true);
    expect(alertsFor(s(99), b)).toEqual([]);
  });
  it("flags only what is beyond the team's own 90th / 10th percentile", () => {
    const b = baselineFrom(team);
    expect(b.cuts.talked_most).toBeCloseTo(0.27); // 27th of 30
    expect(alertsFor(s(28), b)).toEqual(["talked_most", "long_monologue"]);
    expect(alertsFor(s(2), b)).toEqual(["little_back_and_forth", "quick_to_answer"]);
    expect(alertsFor(s(15), b)).toEqual([]);
  });
  it("a team where every call is alike flags none; missing stats flag nothing", () => {
    const same = baselineFrom(Array.from({ length: 25 }, () => s(10)));
    expect(alertsFor(s(10), same)).toEqual([]);
    expect(alertsFor({ talkRatio: null, longestMonologueMs: null, interactivity: null, patienceMs: null }, baselineFrom(team))).toEqual([]);
    expect(alertsFor(undefined, baselineFrom(team))).toEqual([]);
  });
});
