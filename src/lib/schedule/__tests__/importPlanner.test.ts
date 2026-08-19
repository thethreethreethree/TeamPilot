import { describe, it, expect } from "vitest";
import { planImport, type ImportPreview } from "../importPlanner";
import type { GridEntry } from "../gridParser";

/**
 * The commit planner (deterministic). Pins: only shift entries produce shifts/assignments, shifts dedupe by
 * (date,start,end) so a column of identical shifts becomes ONE shift with many assignments, and new staff are
 * the preview names not already in the roster (case-insensitive, de-duplicated).
 */
function e(name: string, date: string, kind: GridEntry["kind"], times?: { start: string; end: string }): GridEntry {
  return { employeeName: name, date, rawCode: "x", kind, times };
}

const preview: ImportPreview = {
  staff: ["ALICE", "ABRIL"],
  entries: [
    e("ALICE", "2026-08-16", "shift", { start: "06:00", end: "15:00" }),
    e("ABRIL", "2026-08-16", "shift", { start: "06:00", end: "15:00" }), // same shift → dedup, 2 assignments
    e("ALICE", "2026-08-17", "off"), // off → nothing
    e("ABRIL", "2026-08-17", "shift", { start: "14:00", end: "23:00" }),
    e("ABRIL", "2026-08-18", "unknown"), // unknown → nothing
  ],
};

describe("planImport", () => {
  it("dedupes shifts by (date,start,end) and keeps every assignment", () => {
    const plan = planImport(preview, []);
    expect(plan.shifts).toHaveLength(2); // the 06:00-15:00@16 (shared) + 14:00-23:00@17
    const morning = plan.shifts.find((s) => s.date === "2026-08-16");
    const morningAssigns = plan.assignments.filter((a) => a.shiftKey === morning?.key).map((a) => a.staffName);
    expect(morningAssigns.sort()).toEqual(["ABRIL", "ALICE"]);
  });

  it("off / unknown / empty entries produce no shift and no assignment", () => {
    const plan = planImport(preview, []);
    // 3 assignments total: ALICE@16, ABRIL@16, ABRIL@17. The off + unknown produce nothing.
    expect(plan.assignments).toHaveLength(3);
  });

  it("newStaff excludes people already in the roster (case-insensitive)", () => {
    const plan = planImport(preview, ["alice"]);
    expect(plan.newStaff).toEqual(["ABRIL"]); // ALICE already exists
  });

  it("newStaff de-duplicates repeated names in the preview", () => {
    const plan = planImport({ staff: ["Bob", "bob", "BOB"], entries: [] }, []);
    expect(plan.newStaff).toEqual(["Bob"]);
  });
});
