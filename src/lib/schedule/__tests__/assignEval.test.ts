import { describe, it, expect } from "vitest";
import { evaluateAssignments, suggestForProposedShift, describeViolation } from "../assignEval";
import { buildEvalContext } from "../evalContext";
import type { ScheduleEvent, ScheduleEventType, Employee } from "../types";

/**
 * Conflict-check for assigning staff to a PROPOSED shift (the plan's "evaluate changes + surface impact",
 * wired for Build). Pins: it reuses the authority to catch double-booking, approved time-off, over-hours, and
 * ineligibility against the CURRENT state — before the shift is created.
 */
function ev(seq: number, type: ScheduleEventType, payload: Record<string, unknown>): ScheduleEvent {
  return { id: `e${seq}`, companyId: "c1", type, actorId: null, payload, occurredAt: "2026-08-19T00:00:00Z", seq };
}
const emp = (id: string, extra: Partial<Employee> = {}): Employee =>
  ({ id, name: id, role: null, employmentType: null, skills: [], certifications: [], maxHoursWeek: null, minHoursWeek: null, status: "active", ...extra } as unknown as Employee);

// E1 already works 09:00-17:00 on 2026-08-20; E2 has approved time off that day; E3 is free.
const EVENTS: ScheduleEvent[] = [
  ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-20", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
  ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "E1" }),
  ev(3, "TIMEOFF_REQUESTED", { timeOffId: "T1", employeeId: "E2", type: "vacation", start: "2026-08-20", end: "2026-08-20" }),
  ev(4, "TIMEOFF_APPROVED", { timeOffId: "T1" }),
];
const EMPLOYEES = [emp("E1"), emp("E2"), emp("E3")];

function ctx() {
  return buildEvalContext({ events: EVENTS, employees: EMPLOYEES });
}

describe("evaluateAssignments — conflicts on a proposed shift", () => {
  const proposed = { date: "2026-08-20", start: "10:00", end: "14:00", requiredHeadcount: 1 };

  it("flags DOUBLE-BOOKING (E1 already works an overlapping shift that day)", () => {
    const impact = evaluateAssignments(ctx(), proposed, ["E1"])[0]!;
    expect(impact.violations.some((v) => v.kind === "double_booked")).toBe(true);
  });

  it("flags approved TIME-OFF (E2 is off that day)", () => {
    const impact = evaluateAssignments(ctx(), proposed, ["E2"])[0]!;
    expect(impact.violations.some((v) => v.kind === "time_off_conflict")).toBe(true);
  });

  it("a free employee (E3) has NO conflicts", () => {
    const impact = evaluateAssignments(ctx(), proposed, ["E3"])[0]!;
    expect(impact.violations).toEqual([]);
  });

  it("evaluates several employees at once, one result each", () => {
    const impacts = evaluateAssignments(ctx(), proposed, ["E1", "E2", "E3"]);
    expect(impacts.map((i) => i.employeeId)).toEqual(["E1", "E2", "E3"]);
    expect(impacts[2]?.violations).toEqual([]); // E3 clean
  });

  it("does NOT report coverage (a shift-level, overridable concern) — only per-employee conflicts", () => {
    const impacts = evaluateAssignments(ctx(), proposed, ["E3"]);
    expect(impacts[0]?.violations.some((v) => v.kind === "coverage")).toBe(false);
  });
});

describe("suggestForProposedShift — who's free for a proposed shift", () => {
  const proposed = { date: "2026-08-20", start: "10:00", end: "14:00", requiredHeadcount: 1 };

  it("suggests only conflict-free staff (E3), excluding the double-booked (E1) and the off (E2)", () => {
    const ids = suggestForProposedShift(ctx(), proposed).map((c) => c.employeeId);
    expect(ids).toContain("E3");
    expect(ids).not.toContain("E1"); // double-booked
    expect(ids).not.toContain("E2"); // approved time off
  });
});

describe("describeViolation", () => {
  it("gives a plain line for each kind", () => {
    expect(describeViolation({ kind: "double_booked", shiftId: "s", employeeId: "e", overridable: false })).toMatch(/overlap/i);
    expect(describeViolation({ kind: "over_hours", employeeId: "e", overBy: 5, overridable: false })).toMatch(/5h/);
  });
});
