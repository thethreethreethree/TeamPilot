import { describe, it, expect } from "vitest";
import { buildEvalContext } from "../evalContext";
import type { ScheduleEvent, Employee } from "../types";

function ev(seq: number, type: ScheduleEvent["type"], payload: Record<string, unknown>): ScheduleEvent {
  return { id: `e${seq}`, companyId: "c1", type, actorId: null, payload, occurredAt: "2026-08-19T00:00:00Z", seq };
}
function emp(over: Partial<Employee> & { id: string }): Employee {
  return { companyId: "c1", name: over.id, role: null, employmentType: null, skills: [], certifications: [], maxHoursWeek: null, minHoursWeek: null, status: "active", ...over };
}
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("buildEvalContext — requirementForShift mapping", () => {
  it("a day-applies coverage requirement applies to every shift", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "day", minHeadcount: 3 }),
    ];
    const ctx = buildEvalContext({ events, employees: [emp({ id: "a" })] });
    expect(ctx.requirementForShift("S1")).toEqual({ minHeadcount: 3, minByRole: {} });
  });

  it("a shift/role requirement WITHOUT a time window applies to every shift (RQ19 — not silently ignored)", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "shift", minHeadcount: 2 }),
    ];
    const ctx = buildEvalContext({ events, employees: [] });
    expect(ctx.requirementForShift("S1")).toEqual({ minHeadcount: 2, minByRole: {} });
  });

  it("a WINDOWED requirement applies only to an overlapping shift", () => {
    // requiredHeadcount 0 here so the test isolates the windowed requirement (a shift's own headcount is a
    // separate floor — RQ22 — tested above).
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "12:00", requiredHeadcount: 0 }),
      ev(2, "SHIFT_DEFINED", { shiftId: "S2", date: "2026-08-16", start: "18:00", end: "22:00", requiredHeadcount: 0 }),
      ev(3, "COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "shift", minHeadcount: 2, timeWindow: { start: "08:00", end: "13:00" } }),
    ];
    const ctx = buildEvalContext({ events, employees: [] });
    expect(ctx.requirementForShift("S1")).toEqual({ minHeadcount: 2, minByRole: {} }); // overlaps 08:00–13:00
    expect(ctx.requirementForShift("S2")).toBeNull(); // 18:00–22:00 does not overlap, and no own floor
  });

  it("COMBINES multiple applicable requirements — strictest headcount AND every role floor (RQ20)", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "day", minHeadcount: 3 }),
      ev(3, "COVERAGE_REQ_DEFINED", { requirementId: U2, appliesTo: "role", minHeadcount: 0, minByRole: { nurse: 1 } }),
    ];
    const ctx = buildEvalContext({ events, employees: [] });
    // headcount = max(3, 0) = 3; role floor from the second requirement must survive (not be dropped).
    expect(ctx.requirementForShift("S1")).toEqual({ minHeadcount: 3, minByRole: { nurse: 1 } });
  });

  it("null when there is NO floor at all (no requirement AND requiredHeadcount 0)", () => {
    const events = [ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 0 })];
    const ctx = buildEvalContext({ events, employees: [] });
    expect(ctx.requirementForShift("S1")).toBeNull();
  });

  it("the shift's OWN requiredHeadcount is a coverage floor even with no coverage requirement (RQ22)", () => {
    // The Build page collects "how many needed" → requiredHeadcount; it must be enforced, not a dead field.
    const events = [ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 3 })];
    const ctx = buildEvalContext({ events, employees: [] });
    expect(ctx.requirementForShift("S1")).toEqual({ minHeadcount: 3, minByRole: {} });
  });

  it("a coverage requirement STRICTER than the shift's headcount wins (max of the two)", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 2 }),
      ev(2, "COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "day", minHeadcount: 5 }),
    ];
    const ctx = buildEvalContext({ events, employees: [] });
    expect(ctx.requirementForShift("S1")).toEqual({ minHeadcount: 5, minByRole: {} }); // max(2, 5)
  });

  it("builds the derived state + employee map the authority needs", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "a" }),
    ];
    const ctx = buildEvalContext({ events, employees: [emp({ id: "a", name: "Ana" })] });
    expect(ctx.state.shifts["S1"]?.assigned).toEqual(["a"]);
    expect(ctx.employees["a"]?.name).toBe("Ana");
  });
});
