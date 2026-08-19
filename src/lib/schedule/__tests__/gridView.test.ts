import { describe, it, expect } from "vitest";
import { buildWeekGrid, relevantRows } from "../gridView";
import type { Shift, Employee } from "../types";

/**
 * The weekly-grid view logic (pure, extracted from the client component). Pins: only shifts in the displayed
 * week appear; each assignee gets a cell carrying the shiftId; the relevance filter shows active staff plus
 * anyone actually working the week (so a deactivated-then-assigned person still shows) and hides
 * deactivated-and-unscheduled staff (the accumulation class).
 */

const shift = (id: string, date: string, start: string, end: string, assigned: string[]): Shift =>
  ({ id, date, start, end, requiredHeadcount: assigned.length, requiredByRole: {}, assigned, status: "published" });

const emp = (id: string, status: "active" | "inactive"): Employee =>
  ({ id, name: id, role: null, employmentType: null, skills: [], certifications: [], maxHoursWeek: null, minHoursWeek: null, status } as unknown as Employee);

const WEEK = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"];

describe("buildWeekGrid", () => {
  it("includes only shifts whose date is in the displayed week", () => {
    const g = buildWeekGrid(
      [shift("s1", "2026-08-18", "09:00", "17:00", ["e1"]), shift("s2", "2026-08-30", "09:00", "17:00", ["e1"])],
      WEEK,
    );
    expect(g.shiftsThisWeek).toBe(1); // s2 is next week, excluded
    expect(g.cell("e1", "2026-08-18")).toEqual({ shiftId: "s1", label: "09:00-17:00", off: false });
    expect(g.cell("e1", "2026-08-30")).toBeNull(); // outside the displayed week
  });

  it("marks a cell OFF when the assigned person has approved time-off overlapping the date", () => {
    const g = buildWeekGrid(
      [shift("s1", "2026-08-19", "09:00", "17:00", ["e1", "e2"])],
      WEEK,
      [{ employeeId: "e1", start: "2026-08-18", end: "2026-08-20" }], // e1 off across the 19th
    );
    expect(g.cell("e1", "2026-08-19")?.off).toBe(true);  // e1 is off → flagged
    expect(g.cell("e2", "2026-08-19")?.off).toBe(false); // e2 works normally
  });

  it("off marking is SPAN-AWARE — an overnight shift hit by time-off on its SECOND day is flagged (matches coverage)", () => {
    const g = buildWeekGrid(
      [shift("s1", "2026-08-19", "22:00", "06:00", ["e1"])], // overnight: occupies 08-19 AND 08-20
      WEEK,
      [{ employeeId: "e1", start: "2026-08-20", end: "2026-08-20" }], // off only on the SECOND day
    );
    expect(g.cell("e1", "2026-08-19")?.off).toBe(true); // still flagged — the shift runs into the off day
  });

  it("gives every assignee their own cell + records each in scheduledIds", () => {
    const g = buildWeekGrid([shift("s1", "2026-08-19", "06:00", "14:00", ["e1", "e2"])], WEEK);
    expect(g.cell("e1", "2026-08-19")).toEqual({ shiftId: "s1", label: "06:00-14:00", off: false });
    expect(g.cell("e2", "2026-08-19")).toEqual({ shiftId: "s1", label: "06:00-14:00", off: false });
    expect([...g.scheduledIds].sort()).toEqual(["e1", "e2"]);
  });

  it("empty week / no shifts → an empty grid", () => {
    const g = buildWeekGrid([], WEEK);
    expect(g.shiftsThisWeek).toBe(0);
    expect(g.cell("e1", "2026-08-19")).toBeNull();
    expect(g.scheduledIds.size).toBe(0);
    expect(g.emptyShiftsThisWeek).toBe(0);
  });

  it("counts shifts with NOBODY assigned (emptyShiftsThisWeek — they render no cells)", () => {
    const g = buildWeekGrid(
      [shift("s1", "2026-08-18", "09:00", "17:00", ["e1"]), shift("s2", "2026-08-19", "06:00", "14:00", [])],
      WEEK,
    );
    expect(g.shiftsThisWeek).toBe(2);
    expect(g.emptyShiftsThisWeek).toBe(1); // s2 has no one assigned → invisible in the grid, surfaced here
    expect(g.cell("e1", "2026-08-19")).toBeNull(); // s2 produced no cell
  });
});

describe("relevantRows", () => {
  it("shows active staff, hides deactivated-and-unscheduled staff", () => {
    const rows = relevantRows([emp("a", "active"), emp("b", "inactive")], new Set());
    expect(rows.map((r) => r.id)).toEqual(["a"]); // b is inactive with no shift → hidden
  });

  it("KEEPS a deactivated staff member who actually works the week", () => {
    const rows = relevantRows([emp("a", "active"), emp("b", "inactive")], new Set(["b"]));
    expect(rows.map((r) => r.id).sort()).toEqual(["a", "b"]); // b has a shift → shown despite inactive
  });
});
