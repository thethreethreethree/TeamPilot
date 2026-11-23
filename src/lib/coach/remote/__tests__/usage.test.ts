import { describe, it, expect } from "vitest";
import { buildUsage } from "../usage";

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
