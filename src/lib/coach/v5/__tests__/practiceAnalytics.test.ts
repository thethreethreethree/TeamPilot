import { describe, it, expect } from "vitest";
import { aggregateRepPractice, summarizePracticeForManager, summarizeTeamPractice } from "../practiceAnalytics";

/**
 * Practice analytics aggregation. Properties that matter (§3.4 honesty / §A18 growth-not-rank):
 *  - an honest empty state when a rep hasn't practiced (never a fake 0);
 *  - trend is a DIRECTION from first→latest APPLIED score (up/flat/down), not a raw rank;
 *  - applied:false attempts count as activity but carry no score (a skill never reached has no meaningful number);
 *  - scores are clamped 0-100; rows in any order are sorted chronologically before first/latest are taken;
 *  - the manager summary exposes ONLY {attempts, latest, trend} — no per-focus detail leaks to the leader view.
 */

const ev = (focus: string, score: number, applied: boolean, at: string) => ({
  payload: { focus, score, applied },
  created_at: at,
});

describe("aggregateRepPractice", () => {
  it("honest empty on no practice", () => {
    const s = aggregateRepPractice([]);
    expect(s.totalAttempts).toBe(0);
    expect(s.appliedAttempts).toBe(0);
    expect(s.latest).toBeNull();
    expect(s.trend).toBeNull();
    expect(s.byFocus).toEqual([]);
  });

  it("computes an UP trend from first→latest applied score, sorting rows chronologically first", () => {
    // Deliberately out of order; the aggregate must sort by created_at.
    const s = aggregateRepPractice([
      ev("Price objection", 82, true, "2026-08-03T00:00:00Z"), // latest
      ev("Price objection", 60, true, "2026-08-01T00:00:00Z"), // first
      ev("Price objection", 70, true, "2026-08-02T00:00:00Z"),
    ]);
    expect(s.totalAttempts).toBe(3);
    expect(s.latest).toBe(82);
    expect(s.trend).toBe("up");
    expect(s.byFocus[0]?.first).toBe(60);
    expect(s.byFocus[0]?.latest).toBe(82);
    expect(s.byFocus[0]?.trend).toBe("up");
  });

  it("down and flat trends respect the delta threshold", () => {
    expect(aggregateRepPractice([ev("F", 80, true, "a"), ev("F", 70, true, "b")]).trend).toBe("down");
    expect(aggregateRepPractice([ev("F", 80, true, "a"), ev("F", 83, true, "b")]).trend).toBe("flat"); // +3 < 6
  });

  it("applied:false counts as activity but contributes no score to the trend", () => {
    const s = aggregateRepPractice([
      ev("F", 0, false, "2026-08-01T00:00:00Z"), // never reached the skill
      ev("F", 70, true, "2026-08-02T00:00:00Z"),
      ev("F", 78, true, "2026-08-03T00:00:00Z"),
    ]);
    expect(s.totalAttempts).toBe(3);
    expect(s.appliedAttempts).toBe(2);
    expect(s.latest).toBe(78);
    expect(s.trend).toBe("up"); // 70 -> 78, the applied:false 0 is ignored
  });

  it("trend is null with fewer than 2 applied points (no fabricated direction)", () => {
    expect(aggregateRepPractice([ev("F", 90, true, "a")]).trend).toBeNull();
    expect(aggregateRepPractice([ev("F", 0, false, "a"), ev("F", 0, false, "b")]).trend).toBeNull();
  });

  it("clamps out-of-range scores and drops malformed rows", () => {
    const s = aggregateRepPractice([
      ev("F", 140, true, "a"),
      ev("F", -5, true, "b"),
      { payload: { score: 50 }, created_at: "c" }, // no focus -> dropped
      { payload: null, created_at: "d" }, // malformed -> dropped
    ]);
    expect(s.totalAttempts).toBe(2); // only the two with a focus
    expect(s.byFocus[0]?.first).toBe(100); // 140 clamped
    expect(s.byFocus[0]?.latest).toBe(0); // -5 clamped
  });

  it("orders byFocus most-recently-practiced first", () => {
    const s = aggregateRepPractice([
      ev("Old skill", 70, true, "2026-08-01T00:00:00Z"),
      ev("New skill", 60, true, "2026-08-05T00:00:00Z"),
    ]);
    expect(s.byFocus[0]?.focus).toBe("New skill");
  });

  it("per-focus latest is NULL (not a fabricated 0) for a skill drilled but never applied (Finding 1, §3.4)", () => {
    const s = aggregateRepPractice([
      ev("Cold open", 10, false, "2026-08-01T00:00:00Z"),
      ev("Cold open", 15, false, "2026-08-02T00:00:00Z"),
    ]);
    expect(s.byFocus[0]?.attempts).toBe(2); // counted as activity
    expect(s.byFocus[0]?.latest).toBeNull(); // NOT 0
    expect(s.byFocus[0]?.first).toBeNull();
  });
});

describe("summarizeTeamPractice — pure aggregate, no individual named (§A18)", () => {
  const m = (attempts: number, latest: number | null, trend: "up" | "flat" | "down" | null) => ({ attempts, latest, trend });

  it("honest zeros when nobody has practiced", () => {
    expect(summarizeTeamPractice([])).toEqual({ activeReps: 0, totalAttempts: 0, avgLatest: null, improving: 0, slipping: 0 });
    expect(summarizeTeamPractice([m(0, null, null)])).toEqual({ activeReps: 0, totalAttempts: 0, avgLatest: null, improving: 0, slipping: 0 });
  });

  it("aggregates active reps, total attempts, avg latest, and trend counts", () => {
    const t = summarizeTeamPractice([
      m(5, 80, "up"),
      m(3, 60, "down"),
      m(0, null, null), // inactive — excluded from activeReps/avg
      m(2, 70, "flat"),
    ]);
    expect(t.activeReps).toBe(3);
    expect(t.totalAttempts).toBe(10);
    expect(t.avgLatest).toBe(70); // (80+60+70)/3
    expect(t.improving).toBe(1);
    expect(t.slipping).toBe(1);
  });

  it("avgLatest is null when active reps have no applied score yet (no fabricated average)", () => {
    expect(summarizeTeamPractice([m(2, null, null), m(1, null, null)]).avgLatest).toBeNull();
  });
});

describe("summarizePracticeForManager — growth signal, not a leaderboard (§A18)", () => {
  it("exposes only attempts/latest/trend, no per-focus detail", () => {
    const m = summarizePracticeForManager([
      ev("Price objection", 60, true, "2026-08-01T00:00:00Z"),
      ev("Price objection", 80, true, "2026-08-02T00:00:00Z"),
    ]);
    expect(m).toEqual({ attempts: 2, latest: 80, trend: "up" });
    expect(Object.keys(m)).toEqual(["attempts", "latest", "trend"]); // no byFocus / scores list leaks
  });

  it("honest empty for a rep who hasn't practiced", () => {
    expect(summarizePracticeForManager([])).toEqual({ attempts: 0, latest: null, trend: null });
  });
});
