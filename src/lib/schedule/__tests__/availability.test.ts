import { describe, it, expect } from "vitest";
import { isAvailable } from "../constraints";
import { evaluateChange, type EvalContext } from "../authority";
import { findResolutions } from "../resolution";
import type { ScheduleState, Employee, Shift, Availability } from "../types";

/**
 * Availability (founder 2026-08-20: BLOCK-but-OVERRIDABLE). Locks: the pure isAvailable predicate, that a
 * manual assign of an unavailable employee is an OVERRIDABLE violation (approvable=true, autoApprovable=false),
 * and that findResolutions EXCLUDES the unavailable (auto-suggest never proposes them). Both branches of
 * every term (opt-in default, unavailableDates, weekly windows, overnight) are exercised — the drift-guard
 * against a dropped term silently defeating the block.
 */

// 2026-08-24 is a Monday (dayOfWeek 1); 2026-08-25 a Tuesday (2).
const MON = "2026-08-24";
const TUE = "2026-08-25";

describe("isAvailable (pure predicate)", () => {
  const day = { date: MON, start: "09:00", end: "17:00" };

  it("opt-in: no availability record → available (existing staff stay schedulable)", () => {
    expect(isAvailable(undefined, day)).toBe(true);
  });

  it("a specific unavailable date blocks that day", () => {
    const a: Availability = { employeeId: "e", weekly: [], unavailableDates: [MON] };
    expect(isAvailable(a, day)).toBe(false);
    expect(isAvailable(a, { ...day, date: TUE })).toBe(true); // a different day is fine
  });

  it("weekly windows are the ONLY times they can work when any are set", () => {
    const a: Availability = { employeeId: "e", weekly: [{ dayOfWeek: 1, from: "08:00", to: "18:00" }], unavailableDates: [] };
    expect(isAvailable(a, day)).toBe(true); // 09-17 fits inside 08-18 on Monday
    expect(isAvailable(a, { date: MON, start: "07:00", end: "12:00" })).toBe(false); // starts before the window
    expect(isAvailable(a, { date: MON, start: "12:00", end: "19:00" })).toBe(false); // ends after the window
    expect(isAvailable(a, { date: TUE, start: "09:00", end: "17:00" })).toBe(false); // no Tuesday window → unavailable
  });

  it("empty weekly imposes no weekly restriction (only specific dates constrain)", () => {
    const a: Availability = { employeeId: "e", weekly: [], unavailableDates: [] };
    expect(isAvailable(a, day)).toBe(true);
  });

  it("an overnight shift is checked on unavailableDates only, never hard-blocked by a same-day window", () => {
    const a: Availability = { employeeId: "e", weekly: [{ dayOfWeek: 1, from: "08:00", to: "18:00" }], unavailableDates: [] };
    expect(isAvailable(a, { date: MON, start: "22:00", end: "06:00" })).toBe(true); // weekly window can't span midnight; not blocked
    const b: Availability = { employeeId: "e", weekly: [], unavailableDates: [MON] };
    expect(isAvailable(b, { date: MON, start: "22:00", end: "06:00" })).toBe(false); // but a marked date still blocks
  });
});

// ── integration with the authority + resolution ──────────────────────────────
function shift(over: Partial<Shift> & { id: string }): Shift {
  return { date: MON, start: "09:00", end: "17:00", requiredHeadcount: 1, requiredByRole: {}, assigned: [], status: "published", ...over };
}
function emp(over: Partial<Employee> & { id: string }): Employee {
  return { companyId: "c1", name: over.id, role: "nurse", employmentType: "full_time", skills: [], certifications: [], maxHoursWeek: 40, minHoursWeek: 0, status: "active", ...over };
}
function ctxOf(shifts: Shift[], employees: Employee[], availability: Record<string, Availability> = {}): EvalContext {
  const state: ScheduleState = { shifts: {}, timeOff: {}, availability, coverageReqs: {} };
  for (const s of shifts) state.shifts[s.id] = s;
  const emap: Record<string, Employee> = {};
  for (const e of employees) emap[e.id] = e;
  return { state, employees: emap, requirementForShift: () => null };
}

describe("availability in the authority + resolution", () => {
  it("assigning an unavailable employee → OVERRIDABLE 'unavailable' (approvable, not auto)", () => {
    const s = shift({ id: "S1" });
    const ctx = ctxOf([s], [emp({ id: "a" })], { a: { employeeId: "a", weekly: [], unavailableDates: [MON] } });
    const v = evaluateChange({ kind: "assign", shiftId: "S1", employeeId: "a" }, ctx);
    expect(v.violations.map((x) => x.kind)).toContain("unavailable");
    const av = v.violations.find((x) => x.kind === "unavailable");
    expect(av?.overridable).toBe(true);
    expect(v.approvable).toBe(true); // block-by-default but manager can assign anyway
    expect(v.autoApprovable).toBe(false);
  });

  it("an available employee assigns clean (no unavailable violation)", () => {
    const s = shift({ id: "S1" });
    const ctx = ctxOf([s], [emp({ id: "a" })], { a: { employeeId: "a", weekly: [{ dayOfWeek: 1, from: "08:00", to: "18:00" }], unavailableDates: [] } });
    const v = evaluateChange({ kind: "assign", shiftId: "S1", employeeId: "a" }, ctx);
    expect(v.violations).toEqual([]);
    expect(v.autoApprovable).toBe(true);
  });

  it("findResolutions EXCLUDES an unavailable employee (auto-suggest never proposes them)", () => {
    const target = shift({ id: "T", assigned: [] });
    const ctx = ctxOf([target], [emp({ id: "free" }), emp({ id: "off" })], {
      off: { employeeId: "off", weekly: [], unavailableDates: [MON] },
    });
    const r = findResolutions("T", ctx);
    expect(r.map((c) => c.employeeId)).toEqual(["free"]); // "off" filtered out
  });
});
