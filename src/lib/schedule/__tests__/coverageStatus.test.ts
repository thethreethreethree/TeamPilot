import { describe, it, expect } from "vitest";
import { findCoverageGaps } from "../coverageStatus";
import { buildEvalContext } from "../evalContext";
import type { ScheduleEvent, Employee } from "../types";

const gapsOf = (events: ScheduleEvent[], employees: Employee[]) => findCoverageGaps(buildEvalContext({ events, employees }));

/**
 * Proactive coverage-gap finder. Reuses the authority's building blocks, so it must agree with the reactive
 * time-off check: a shift is a gap iff its PRESENT staff (excluding approved-off, RQ15) fall below its floor
 * (a coverage requirement OR its own requiredHeadcount, RQ22).
 */
function ev(seq: number, type: ScheduleEvent["type"], payload: Record<string, unknown>): ScheduleEvent {
  return { id: `e${seq}`, companyId: "c1", type, actorId: null, payload, occurredAt: "2026-08-19T00:00:00Z", seq };
}
function emp(id: string): Employee {
  return { id, companyId: "c1", name: id, role: "nurse", employmentType: null, skills: [], certifications: [], maxHoursWeek: null, minHoursWeek: null, status: "active" };
}
const R1 = "11111111-1111-4111-8111-111111111111";

describe("findCoverageGaps", () => {
  it("flags a shift below a coverage requirement, ignores a fully-covered one, earliest first", () => {
    const events = [
      // S1 needs 2 (day requirement), has 1 → gap. S2 needs 2, has 2 → ok.
      ev(1, "COVERAGE_REQ_DEFINED", { requirementId: R1, appliesTo: "day", minHeadcount: 2 }),
      ev(2, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 0 }),
      ev(3, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "a" }),
      ev(4, "SHIFT_DEFINED", { shiftId: "S2", date: "2026-08-20", start: "09:00", end: "17:00", requiredHeadcount: 0 }),
      ev(5, "EMPLOYEE_ASSIGNED", { shiftId: "S2", employeeId: "a" }),
      ev(6, "EMPLOYEE_ASSIGNED", { shiftId: "S2", employeeId: "b" }),
    ];
    const gaps = gapsOf(events, [emp("a"), emp("b")]);
    expect(gaps.map((g) => g.shiftId)).toEqual(["S1"]); // only S1 is short
    expect(gaps[0]?.assigned).toBe(1);
    expect(gaps[0]?.gaps).toEqual([{ kind: "headcount", need: 1 }]);
  });

  it("does not count an assignee on APPROVED time-off as present (RQ15)", () => {
    const events = [
      ev(1, "COVERAGE_REQ_DEFINED", { requirementId: R1, appliesTo: "day", minHeadcount: 2 }),
      ev(2, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 0 }),
      ev(3, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "a" }),
      ev(4, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "b" }),
      ev(5, "TIMEOFF_REQUESTED", { timeOffId: R1, employeeId: "b", type: "sick", start: "2026-08-21", end: "2026-08-21" }),
      ev(6, "TIMEOFF_APPROVED", { timeOffId: R1 }),
    ];
    const gaps = gapsOf(events, [emp("a"), emp("b")]);
    expect(gaps.map((g) => g.shiftId)).toEqual(["S1"]); // b is off → present 1 < 2
    expect(gaps[0]?.assigned).toBe(1);
  });

  it("flags a shift below its OWN requiredHeadcount even with no coverage requirement (RQ22)", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 3 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "a" }),
      ev(3, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "b" }),
    ];
    const gaps = gapsOf(events, [emp("a"), emp("b")]);
    expect(gaps.map((g) => g.shiftId)).toEqual(["S1"]); // needs 3, has 2
    expect(gaps[0]?.gaps).toEqual([{ kind: "headcount", need: 1 }]);
  });

  it("no gaps when every shift meets its floor (honest empty)", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "a" }),
    ];
    expect(gapsOf(events, [emp("a")])).toEqual([]);
  });
});
