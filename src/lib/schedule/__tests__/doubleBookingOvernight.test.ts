import { describe, it, expect } from "vitest";
import { shiftsTimeClash } from "../constraints";
import { evaluateChange, type EvalContext } from "../authority";
import type { ScheduleState, Employee, Shift } from "../types";

/**
 * Double-booking across ANY dates (the adjacent-date overnight gap — audit 2026-08-20). The old check
 * (`o.date === shift.date`) missed an overnight shift running into the next day's early shift. shiftsTimeClash
 * composes date + time, so it catches that while still allowing legitimate same-day split shifts (RQ9).
 */

describe("shiftsTimeClash", () => {
  const s = (date: string, start: string, end: string) => ({ date, start, end });

  it("same-day: overlap clashes, split + touching do not (RQ9 preserved)", () => {
    expect(shiftsTimeClash(s("2026-08-20", "10:00", "14:00"), s("2026-08-20", "13:00", "17:00"))).toBe(true);
    expect(shiftsTimeClash(s("2026-08-20", "10:00", "14:00"), s("2026-08-20", "19:00", "23:00"))).toBe(false); // split
    expect(shiftsTimeClash(s("2026-08-20", "10:00", "14:00"), s("2026-08-20", "14:00", "18:00"))).toBe(false); // touch
  });

  it("adjacent-date: an overnight shift clashes with the next day's early shift, not a later one", () => {
    expect(shiftsTimeClash(s("2026-08-20", "22:00", "06:00"), s("2026-08-21", "05:00", "09:00"))).toBe(true); // 05:00–06:00
    expect(shiftsTimeClash(s("2026-08-20", "22:00", "06:00"), s("2026-08-21", "07:00", "09:00"))).toBe(false); // gap after 06:00
    expect(shiftsTimeClash(s("2026-08-20", "22:00", "06:00"), s("2026-08-21", "04:00", "08:00"))).toBe(true); // two-overnight overlap
  });

  it("far-apart dates never clash", () => {
    expect(shiftsTimeClash(s("2026-08-20", "10:00", "14:00"), s("2026-08-22", "10:00", "14:00"))).toBe(false);
  });
});

// ── authority integration ────────────────────────────────────────────────────
function shift(over: Partial<Shift> & { id: string }): Shift {
  return { date: "2026-08-20", start: "09:00", end: "17:00", requiredHeadcount: 1, requiredByRole: {}, assigned: [], status: "published", ...over };
}
function emp(over: Partial<Employee> & { id: string }): Employee {
  return { companyId: "c1", name: over.id, role: "nurse", employmentType: "full_time", skills: [], certifications: [], maxHoursWeek: 400, minHoursWeek: 0, status: "active", ...over };
}
function ctxOf(shifts: Shift[], employees: Employee[]): EvalContext {
  const state: ScheduleState = { shifts: {}, timeOff: {}, availability: {}, coverageReqs: {} };
  for (const s of shifts) state.shifts[s.id] = s;
  const emap: Record<string, Employee> = {};
  for (const e of employees) emap[e.id] = e;
  return { state, employees: emap, requirementForShift: () => null };
}

describe("evaluateChange — double-booking is span-aware", () => {
  it("assigning into the morning after an overnight shift is double_booked (was silently allowed)", () => {
    const night = shift({ id: "N", date: "2026-08-20", start: "22:00", end: "06:00", assigned: ["a"] });
    const morning = shift({ id: "M", date: "2026-08-21", start: "05:00", end: "09:00", assigned: [] });
    const v = evaluateChange({ kind: "assign", shiftId: "M", employeeId: "a" }, ctxOf([night, morning], [emp({ id: "a" })]));
    const db = v.violations.find((x) => x.kind === "double_booked");
    expect(db).toBeTruthy();
    expect(db?.overridable).toBe(false); // absolute — cannot be in two places
    expect(v.approvable).toBe(false);
  });

  it("a non-overlapping morning shift after the overnight ends is fine", () => {
    const night = shift({ id: "N", date: "2026-08-20", start: "22:00", end: "06:00", assigned: ["a"] });
    const later = shift({ id: "L", date: "2026-08-21", start: "07:00", end: "11:00", assigned: [] });
    const v = evaluateChange({ kind: "assign", shiftId: "L", employeeId: "a" }, ctxOf([night, later], [emp({ id: "a" })]));
    expect(v.violations.some((x) => x.kind === "double_booked")).toBe(false);
  });
});
