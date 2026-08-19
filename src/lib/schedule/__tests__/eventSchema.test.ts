import { describe, it, expect } from "vitest";
import { validateScheduleEvent } from "../eventSchema";

/**
 * The append boundary rejects malformed events BEFORE they reach the immutable log (build plan:
 * "validate before append; never write an unvalidated object"). A bad payload can never become an
 * event that later corrupts a replay.
 */

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("validateScheduleEvent — append-boundary guard", () => {
  it("accepts a well-formed SHIFT_DEFINED", () => {
    const r = validateScheduleEvent("SHIFT_DEFINED", {
      shiftId: U1, date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 2,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const r = validateScheduleEvent("MAKE_COFFEE", { shiftId: U1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toMatch(/unknown event type/i);
  });

  it("rejects SHIFT_DEFINED missing requiredHeadcount", () => {
    const r = validateScheduleEvent("SHIFT_DEFINED", { shiftId: U1, date: "2026-08-21", start: "09:00", end: "17:00" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-HH:mm time", () => {
    const r = validateScheduleEvent("SHIFT_DEFINED", { shiftId: U1, date: "2026-08-21", start: "9:00", end: "17:00", requiredHeadcount: 1 });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    const r = validateScheduleEvent("EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "E1" });
    expect(r.ok).toBe(false);
  });

  it("accepts a valid TIMEOFF_REQUESTED but rejects an out-of-vocabulary type", () => {
    expect(validateScheduleEvent("TIMEOFF_REQUESTED", { timeOffId: U1, employeeId: U2, type: "vacation", start: "2026-08-21", end: "2026-08-22" }).ok).toBe(true);
    expect(validateScheduleEvent("TIMEOFF_REQUESTED", { timeOffId: U1, employeeId: U2, type: "holiday", start: "2026-08-21", end: "2026-08-22" }).ok).toBe(false);
  });

  it("accepts COVERAGE_REQ_DEFINED with role minimums", () => {
    const r = validateScheduleEvent("COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "day", minHeadcount: 3, minByRole: { nurse: 1 } });
    expect(r.ok).toBe(true);
  });

  it("strips nothing but reports the field path on failure", () => {
    const r = validateScheduleEvent("COVERAGE_REQ_DEFINED", { requirementId: U1, appliesTo: "planet", minHeadcount: 3 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(" ")).toMatch(/appliesTo/);
  });
});
