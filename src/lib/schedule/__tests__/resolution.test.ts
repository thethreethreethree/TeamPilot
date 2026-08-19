import { describe, it, expect } from "vitest";
import { findResolutions } from "../resolution";
import type { EvalContext } from "../authority";
import type { ScheduleState, Employee, Shift } from "../types";

/**
 * Phase 4 resolution search (deterministic). A candidate must be one the APPROVAL gate would also accept —
 * so the search reuses evaluateChange (A40 single source). These lock: eligibility/availability filtering,
 * fair-load ranking, and an honest empty result.
 */
function shift(over: Partial<Shift> & { id: string }): Shift {
  return { date: "2026-08-21", start: "09:00", end: "18:00", requiredHeadcount: 1, requiredByRole: {}, assigned: [], status: "published", ...over };
}
function emp(over: Partial<Employee> & { id: string }): Employee {
  return { companyId: "c1", name: over.id, role: "nurse", employmentType: "full_time", skills: [], certifications: [], maxHoursWeek: 40, minHoursWeek: 0, status: "active", ...over };
}
function ctxOf(shifts: Shift[], employees: Employee[]): EvalContext {
  const state: ScheduleState = { shifts: {}, timeOff: {}, availability: {}, coverageReqs: {} };
  for (const s of shifts) state.shifts[s.id] = s;
  const emap: Record<string, Employee> = {};
  for (const e of employees) emap[e.id] = e;
  return { state, employees: emap, requirementForShift: () => null };
}

describe("findResolutions", () => {
  it("returns eligible, available employees ranked by current hours ascending (fair load)", () => {
    // busy already worked a 9h shift; free has 0h → free should rank first.
    const target = shift({ id: "T", date: "2026-08-22", assigned: [] });
    const other = shift({ id: "O", date: "2026-08-20", assigned: ["busy"] });
    const ctx = ctxOf([target, other], [emp({ id: "busy", name: "busy" }), emp({ id: "free", name: "free" })]);
    const r = findResolutions("T", ctx);
    expect(r.map((c) => c.employeeId)).toEqual(["free", "busy"]);
    expect(r[0]?.currentHours).toBe(0);
    expect(r[0]?.addsHours).toBe(9);
  });

  it("currentHours is WEEK-SCOPED to the shift being filled, not all-time (RQ8 sibling — shared helper)", () => {
    // `a` worked 9h in the PRIOR week; the target is this week. Their fair-load figure for THIS week is 0 —
    // an all-time sum (the old local copy) would report 9 and mis-rank them as loaded.
    const target = shift({ id: "T", date: "2026-08-22", assigned: [] }); // week of Mon 2026-08-17
    const priorWeek = shift({ id: "P", date: "2026-08-13", start: "09:00", end: "18:00", assigned: ["a"] }); // prev week, 9h
    const r = findResolutions("T", ctxOf([target, priorWeek], [emp({ id: "a" })]));
    expect(r[0]?.currentHours).toBe(0);
  });

  it("excludes someone already assigned to the shift", () => {
    const t = shift({ id: "T", assigned: ["a"] });
    const r = findResolutions("T", ctxOf([t], [emp({ id: "a" }), emp({ id: "b" })]));
    expect(r.map((c) => c.employeeId)).toEqual(["b"]);
  });

  it("excludes an employee double-booked that date (via the authority)", () => {
    const t = shift({ id: "T", date: "2026-08-21", assigned: [] });
    const clash = shift({ id: "C", date: "2026-08-21", assigned: ["a"] });
    const r = findResolutions("T", ctxOf([t, clash], [emp({ id: "a" }), emp({ id: "b" })]));
    expect(r.map((c) => c.employeeId)).toEqual(["b"]);
  });

  it("excludes an employee on approved time-off that date", () => {
    const t = shift({ id: "T", date: "2026-08-21", assigned: [] });
    const ctx = ctxOf([t], [emp({ id: "a" }), emp({ id: "b" })]);
    ctx.state.timeOff["T1"] = { id: "T1", employeeId: "a", type: "vacation", start: "2026-08-21", end: "2026-08-21", partial: false, status: "approved" };
    const r = findResolutions("T", ctx);
    expect(r.map((c) => c.employeeId)).toEqual(["b"]);
  });

  it("excludes an inactive employee and one over their hours cap", () => {
    const t = shift({ id: "T", date: "2026-08-22", assigned: [] });
    const priorBig = shift({ id: "P", date: "2026-08-20", start: "09:00", end: "18:00", assigned: ["capped"] });
    const ctx = ctxOf([t, priorBig], [
      emp({ id: "inactive", status: "inactive" }),
      emp({ id: "capped", maxHoursWeek: 9 }), // already 9h → adding 9h more exceeds 9
      emp({ id: "ok" }),
    ]);
    expect(findResolutions("T", ctx).map((c) => c.employeeId)).toEqual(["ok"]);
  });

  it("honest empty result when nobody is available (never throws)", () => {
    const t = shift({ id: "T", assigned: ["a"] });
    expect(findResolutions("T", ctxOf([t], [emp({ id: "a" })]))).toEqual([]);
    expect(findResolutions("MISSING", ctxOf([t], [emp({ id: "a" })]))).toEqual([]);
  });
});
