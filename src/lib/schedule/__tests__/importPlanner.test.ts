import { describe, it, expect } from "vitest";
import { planImport, supersededShiftIds, dateSpan, type ImportPreview } from "../importPlanner";
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

describe("supersededShiftIds — replace-the-week span", () => {
  const existing = [
    { id: "a", date: "2026-08-15" }, // before span
    { id: "b", date: "2026-08-17" }, // in span
    { id: "c", date: "2026-08-19" }, // in span, mid-week with no new shift → still superseded
    { id: "d", date: "2026-08-21" }, // after span
  ];
  const planned = [{ date: "2026-08-17" }, { date: "2026-08-20" }]; // span 08-17..08-20

  it("supersedes every existing shift inside the imported date SPAN (min..max), inclusive", () => {
    expect(supersededShiftIds(existing, planned).sort()).toEqual(["b", "c"]);
  });

  it("clears a mid-span date that the corrected week no longer staffs", () => {
    // 'c' (08-19) is inside the span but the import has no 08-19 shift — replace-the-week still clears it.
    expect(supersededShiftIds(existing, planned)).toContain("c");
  });

  it("supersedes nothing when the import has no shifts (also covers a first import)", () => {
    expect(supersededShiftIds(existing, [])).toEqual([]);
    expect(supersededShiftIds([], planned)).toEqual([]);
  });

  it("a single-day import supersedes only that day", () => {
    expect(supersededShiftIds(existing, [{ date: "2026-08-17" }])).toEqual(["b"]);
  });
});

describe("dateSpan — the replace range shown to the manager", () => {
  it("returns [min, max] of the dates", () => {
    expect(dateSpan([{ date: "2026-08-20" }, { date: "2026-08-17" }, { date: "2026-08-19" }])).toEqual({ from: "2026-08-17", to: "2026-08-20" });
  });
  it("surfaces a typo'd wide span (the whole point — the manager SEES the bad range)", () => {
    // A stray 2020 date widens the span to six years — visible in the warning, not a silent large delete.
    expect(dateSpan([{ date: "2020-01-01" }, { date: "2026-08-19" }])).toEqual({ from: "2020-01-01", to: "2026-08-19" });
  });
  it("null for an empty set", () => {
    expect(dateSpan([])).toBeNull();
  });
});
