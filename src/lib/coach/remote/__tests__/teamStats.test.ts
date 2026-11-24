import { describe, it, expect } from "vitest";
import { teamCallStats, type StatRow } from "../teamStats";

const row = (o: Partial<StatRow>): StatRow => ({ sessionId: "s", repId: "r", version: 1, talkRatioTime: null, longestRepMonologueMs: null, longestCustomerStoryMs: null, interactivity: null, patienceMs: null, repQuestionsPerHour: null, ...o });

describe("teamCallStats (F10.9)", () => {
  const out = teamCallStats(
    [
      row({ sessionId: "a1", repId: "ana", version: 1, talkRatioTime: 0.9 }),
      row({ sessionId: "a1", repId: "ana", version: 2, talkRatioTime: 0.5, interactivity: 4 }), // latest version wins
      row({ sessionId: "a2", repId: "ana", talkRatioTime: 0.7, interactivity: null }), // not measurable ≠ 0
      row({ sessionId: "b1", repId: "bo", talkRatioTime: 0.3, interactivity: 8 }),
    ],
    new Map([["ana", "Ana"], ["bo", "Bo"]]),
  );
  it("one row per call (its latest version), averaged per rep over measurable calls only", () => {
    const ana = out.reps.find((r) => r.repId === "ana")!;
    expect(ana.calls).toBe(2);
    expect(ana.talkRatioTime).toBeCloseTo(0.6);
    expect(ana.interactivity).toBe(4);
    expect(ana.patienceMs).toBeNull();
  });
  it("the team row averages over calls, not reps; rows are alphabetical", () => {
    expect(out.team.calls).toBe(3);
    expect(out.team.talkRatioTime).toBeCloseTo((0.5 + 0.7 + 0.3) / 3);
    expect(out.reps.map((r) => r.name)).toEqual(["Ana", "Bo"]);
  });
});
