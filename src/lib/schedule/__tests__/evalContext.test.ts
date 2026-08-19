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

describe("buildEvalContext — requirementForShift mapping", () => {
  it("a day-applies coverage requirement applies to every shift", () => {
    const events = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "day", minHeadcount: 3 }),
    ];
    const ctx = buildEvalContext({ events, employees: [emp({ id: "a" })] });
    expect(ctx.requirementForShift("S1")).toEqual({ minHeadcount: 3, minByRole: {} });
  });

  it("null when no requirement applies", () => {
    const events = [ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-16", start: "09:00", end: "17:00", requiredHeadcount: 1 })];
    const ctx = buildEvalContext({ events, employees: [] });
    expect(ctx.requirementForShift("S1")).toBeNull();
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
