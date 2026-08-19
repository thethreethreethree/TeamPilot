import { describe, it, expect } from "vitest";
import { evaluateChange, type EvalContext } from "../authority";
import type { ScheduleState, Employee, Shift } from "../types";

/**
 * Phase 3 acceptance (A40 / §2.2 — the money rule): ONE authority returns the verdict; the drift-guard
 * exercises BOTH branches of every term, ESPECIALLY the override (overridable coverage vs absolute
 * conflict). A dropped or inverted term here silently approves an ineligible assignment or blocks a
 * legitimate override — the exact A40 failure.
 */

function shift(over: Partial<Shift> & { id: string }): Shift {
  return { date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 1, requiredByRole: {}, assigned: [], status: "published", ...over };
}
function emp(over: Partial<Employee> & { id: string }): Employee {
  return { companyId: "c1", name: over.id, role: "nurse", employmentType: "full_time", skills: [], certifications: [], maxHoursWeek: 40, minHoursWeek: 0, status: "active", ...over };
}
function ctxOf(shifts: Shift[], employees: Employee[], req: (id: string) => { minHeadcount: number; minByRole: Record<string, number> } | null): EvalContext {
  const state: ScheduleState = { shifts: {}, timeOff: {}, availability: {}, coverageReqs: {} };
  for (const s of shifts) state.shifts[s.id] = s;
  const emap: Record<string, Employee> = {};
  for (const e of employees) emap[e.id] = e;
  return { state, employees: emap, requirementForShift: req };
}

describe("evaluateChange — the single authority (A40)", () => {
  it("time-off with NO coverage impact → autoApprovable (zero-impact auto-approve)", () => {
    // shift needs 1, has 2 assigned; the requester leaving still leaves 1 → covered.
    const s = shift({ id: "S1", assigned: ["a", "b"], requiredHeadcount: 1 });
    const ctx = ctxOf([s], [emp({ id: "a" }), emp({ id: "b" })], () => ({ minHeadcount: 1, minByRole: {} }));
    const v = evaluateChange({ kind: "time_off", employeeId: "a", start: "2026-08-21", end: "2026-08-21" }, ctx);
    expect(v.autoApprovable).toBe(true);
    expect(v.approvable).toBe(true);
    expect(v.violations).toEqual([]);
  });

  it("time-off that DROPS coverage → OVERRIDABLE: approvable=true, autoApprovable=false (manager may override)", () => {
    const s = shift({ id: "S1", assigned: ["a"], requiredHeadcount: 1 });
    const ctx = ctxOf([s], [emp({ id: "a" })], () => ({ minHeadcount: 1, minByRole: {} }));
    const v = evaluateChange({ kind: "time_off", employeeId: "a", start: "2026-08-21", end: "2026-08-21" }, ctx);
    expect(v.autoApprovable).toBe(false);
    expect(v.approvable).toBe(true); // block-by-default but manager-OVERRIDABLE (the override branch)
    expect(v.violations).toHaveLength(1);
    expect(v.violations[0]?.kind).toBe("coverage");
    expect(v.violations[0]?.overridable).toBe(true);
    expect(v.affectedShifts).toEqual(["S1"]);
  });

  it("assign an ELIGIBLE, free employee → autoApprovable", () => {
    const s = shift({ id: "S1", assigned: [], requiredByRole: {} });
    const ctx = ctxOf([s], [emp({ id: "a" })], () => null);
    const v = evaluateChange({ kind: "assign", shiftId: "S1", employeeId: "a" }, ctx);
    expect(v.autoApprovable).toBe(true);
    expect(v.approvable).toBe(true);
  });

  it("assign an INELIGIBLE employee → ABSOLUTE: approvable=false (the block branch)", () => {
    const s = shift({ id: "S1", assigned: [], requiredByRole: { nurse: 1 } });
    const ctx = ctxOf([s], [emp({ id: "a", role: "cashier" })], () => null);
    const v = evaluateChange({ kind: "assign", shiftId: "S1", employeeId: "a" }, ctx);
    expect(v.approvable).toBe(false);
    expect(v.autoApprovable).toBe(false);
    expect(v.violations.some((x) => x.kind === "ineligible" && x.overridable === false)).toBe(true);
  });

  it("assign a DOUBLE-BOOKED employee (already on another shift that date) → ABSOLUTE block", () => {
    const s1 = shift({ id: "S1", date: "2026-08-21", assigned: ["a"] });
    const s2 = shift({ id: "S2", date: "2026-08-21", assigned: [] });
    const ctx = ctxOf([s1, s2], [emp({ id: "a" })], () => null);
    const v = evaluateChange({ kind: "assign", shiftId: "S2", employeeId: "a" }, ctx);
    expect(v.approvable).toBe(false);
    expect(v.violations.some((x) => x.kind === "double_booked")).toBe(true);
  });

  it("a SPLIT shift (same day, non-overlapping times) is NOT double-booked — but an overlapping one is", () => {
    // The VA schedules have split shifts (e.g. 10:00–14:00 AND 19:00–23:00). A same-DATE check would wrongly
    // block the second; the real rule is a TIME clash.
    const morning = shift({ id: "M", date: "2026-08-21", start: "10:00", end: "14:00", assigned: ["a"] });
    const evening = shift({ id: "E", date: "2026-08-21", start: "19:00", end: "23:00", assigned: [] });
    const overlap = shift({ id: "O", date: "2026-08-21", start: "13:00", end: "17:00", assigned: [] });
    const ctx = ctxOf([morning, evening, overlap], [emp({ id: "a" })], () => null);
    const vSplit = evaluateChange({ kind: "assign", shiftId: "E", employeeId: "a" }, ctx);
    expect(vSplit.violations.some((x) => x.kind === "double_booked")).toBe(false); // no time overlap → allowed
    expect(vSplit.autoApprovable).toBe(true);
    const vOverlap = evaluateChange({ kind: "assign", shiftId: "O", employeeId: "a" }, ctx);
    expect(vOverlap.violations.some((x) => x.kind === "double_booked")).toBe(true); // 13:00–17:00 overlaps 10:00–14:00
  });

  it("assign during APPROVED time-off → ABSOLUTE block", () => {
    const s = shift({ id: "S1", date: "2026-08-21", assigned: [] });
    const ctx = ctxOf([s], [emp({ id: "a" })], () => null);
    ctx.state.timeOff["T1"] = { id: "T1", employeeId: "a", type: "vacation", start: "2026-08-20", end: "2026-08-22", partial: false, status: "approved" };
    const v = evaluateChange({ kind: "assign", shiftId: "S1", employeeId: "a" }, ctx);
    expect(v.approvable).toBe(false);
    expect(v.violations.some((x) => x.kind === "time_off_conflict")).toBe(true);
  });

  it("a colleague already on approved time-off does NOT count toward coverage (RQ15)", () => {
    // Shift needs 1; A and B are both assigned, but B is ALREADY approved off that day (approving time-off
    // doesn't unassign). Evaluating A's time-off removes A, leaving only B — who is off — so real coverage is
    // 0. Without excluding the off colleague the check would count B and wrongly report the shift covered.
    const s = shift({ id: "S1", date: "2026-08-21", assigned: ["a", "b"], requiredHeadcount: 1 });
    const ctx = ctxOf([s], [emp({ id: "a" }), emp({ id: "b" })], () => ({ minHeadcount: 1, minByRole: {} }));
    ctx.state.timeOff["T1"] = { id: "T1", employeeId: "b", type: "vacation", start: "2026-08-21", end: "2026-08-21", partial: false, status: "approved" };
    const v = evaluateChange({ kind: "time_off", employeeId: "a", start: "2026-08-21", end: "2026-08-21" }, ctx);
    expect(v.violations.some((x) => x.kind === "coverage")).toBe(true); // B is off → removing A leaves 0
  });

  it("an OVERNIGHT shift running into an approved day off conflicts (span-aware); a day shift does not", () => {
    // RQ10: an overnight shift on X occupies X AND X+1. Time-off on X+1 must block it; the old check saw
    // only X. Control: a same-start-date DAY shift does not reach X+1, so no conflict.
    const overnight = shift({ id: "N", date: "2026-08-21", start: "22:00", end: "02:00", assigned: [] });
    const day = shift({ id: "D", date: "2026-08-21", start: "09:00", end: "17:00", assigned: [] });
    const ctx = ctxOf([overnight, day], [emp({ id: "a" })], () => null);
    // approved OFF on the 22nd only (the morning the overnight shift runs into)
    ctx.state.timeOff["T1"] = { id: "T1", employeeId: "a", type: "vacation", start: "2026-08-22", end: "2026-08-22", partial: false, status: "approved" };
    const vNight = evaluateChange({ kind: "assign", shiftId: "N", employeeId: "a" }, ctx);
    expect(vNight.violations.some((x) => x.kind === "time_off_conflict")).toBe(true); // runs into the 22nd
    const vDay = evaluateChange({ kind: "assign", shiftId: "D", employeeId: "a" }, ctx);
    expect(vDay.violations.some((x) => x.kind === "time_off_conflict")).toBe(false); // day shift stays on the 21st
  });

  it("assign that exceeds the HOURS CAP → ABSOLUTE block; a REQUESTED (not approved) time-off does NOT block", () => {
    // employee already on a 9h shift, cap 10; adding another 9h → 18h > 10.
    const s1 = shift({ id: "S1", date: "2026-08-20", start: "09:00", end: "18:00", assigned: ["a"] });
    const s2 = shift({ id: "S2", date: "2026-08-21", start: "09:00", end: "18:00", assigned: [] });
    const ctx = ctxOf([s1, s2], [emp({ id: "a", maxHoursWeek: 10 })], () => null);
    // a REQUESTED (pending) time-off must NOT count as an approved conflict (both branches of the status term)
    ctx.state.timeOff["T1"] = { id: "T1", employeeId: "a", type: "sick", start: "2026-08-21", end: "2026-08-21", partial: false, status: "requested" };
    const v = evaluateChange({ kind: "assign", shiftId: "S2", employeeId: "a" }, ctx);
    expect(v.violations.some((x) => x.kind === "over_hours")).toBe(true);
    expect(v.violations.some((x) => x.kind === "time_off_conflict")).toBe(false); // requested != approved
    expect(v.approvable).toBe(false);
  });

  it("HOURS CAP is scoped to the target shift's WEEK — a PRIOR week's hours do not count", () => {
    // Regression lock: `weeklyHoursOf` once summed ALL history (state.shifts holds the whole append-only
    // log), so as weeks accumulated a within-week assignment falsely tripped over_hours. Here: cap 20;
    // a 10h shift in the PRIOR week (Aug 13) + a 9h shift already this week (Aug 20); assigning a 9h
    // shift Aug 21 → this-week total 18 ≤ 20 (approve). Under the old all-time sum it was 10+9+9=28 > 20.
    const prior = shift({ id: "S0", date: "2026-08-13", start: "09:00", end: "19:00", assigned: ["a"] }); // prev week, 10h
    const s1 = shift({ id: "S1", date: "2026-08-20", start: "09:00", end: "18:00", assigned: ["a"] }); // this week, 9h
    const s2 = shift({ id: "S2", date: "2026-08-21", start: "09:00", end: "18:00", assigned: [] }); // this week, 9h
    const ctx = ctxOf([prior, s1, s2], [emp({ id: "a", maxHoursWeek: 20 })], () => null);
    const v = evaluateChange({ kind: "assign", shiftId: "S2", employeeId: "a" }, ctx);
    expect(v.violations.some((x) => x.kind === "over_hours")).toBe(false); // week-scoped 18 ≤ 20
    expect(v.autoApprovable).toBe(true);
  });

  it("an ABSOLUTE violation dominates a coverage gap (mixed → not approvable)", () => {
    // ineligible AND coverage would still be short → absolute wins, approvable=false.
    const s = shift({ id: "S1", assigned: [], requiredByRole: { nurse: 2 } });
    const ctx = ctxOf([s], [emp({ id: "a", role: "cashier" })], () => ({ minHeadcount: 2, minByRole: { nurse: 2 } }));
    const v = evaluateChange({ kind: "assign", shiftId: "S1", employeeId: "a" }, ctx);
    expect(v.approvable).toBe(false); // the absolute (ineligible) term blocks regardless of the overridable one
  });
});
