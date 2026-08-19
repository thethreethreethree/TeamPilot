import { describe, it, expect } from "vitest";
import { deriveState } from "../deriveState";
import type { ScheduleEvent, ScheduleEventType } from "../types";

/**
 * Phase 1 acceptance (build plan): appending events and replaying yields correct derived state; a
 * correction is a NEW event (never an in-place edit); full history intact; replay reproduces
 * identical state. These tests ARE that acceptance, and they are the structural gate (A30) that
 * fails if the projector ever stops being pure/deterministic.
 */

function ev(seq: number, type: ScheduleEventType, payload: Record<string, unknown>): ScheduleEvent {
  return { id: `e${seq}`, companyId: "c1", type, actorId: null, payload, occurredAt: "2026-08-19T00:00:00Z", seq };
}

// A representative log: define a 2-person shift, assign two, publish, one approved vacation, then a
// CORRECTION (unassign E1) expressed as a new event — never an edit to a past one.
const LOG: ScheduleEvent[] = [
  ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 2 }),
  ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "E1" }),
  ev(3, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "E2" }),
  ev(4, "SHIFT_PUBLISHED", { shiftId: "S1" }),
  ev(5, "TIMEOFF_REQUESTED", { timeOffId: "T1", employeeId: "E1", type: "vacation", start: "2026-08-21", end: "2026-08-21" }),
  ev(6, "TIMEOFF_APPROVED", { timeOffId: "T1" }),
  ev(7, "EMPLOYEE_UNASSIGNED", { shiftId: "S1", employeeId: "E1" }),
];

describe("deriveState — replay foundation (Phase 1)", () => {
  it("replays the full log into the expected state", () => {
    const s = deriveState(LOG);
    expect(s.shifts["S1"]).toEqual({
      id: "S1",
      date: "2026-08-21",
      start: "09:00",
      end: "17:00",
      requiredHeadcount: 2,
      requiredByRole: {},
      assigned: ["E2"], // E1 was unassigned by the correction event
      status: "published",
    });
    expect(s.timeOff["T1"]?.status).toBe("approved");
    expect(s.timeOff["T1"]?.type).toBe("vacation");
  });

  it("is DETERMINISTIC — replaying the same log twice yields identical state", () => {
    expect(deriveState(LOG)).toEqual(deriveState(LOG));
  });

  it("is order-INDEPENDENT of input array order (it folds by seq)", () => {
    const shuffled = [LOG[6], LOG[0], LOG[3], LOG[1], LOG[5], LOG[2], LOG[4]] as ScheduleEvent[];
    expect(deriveState(shuffled)).toEqual(deriveState(LOG));
  });

  it("a correction is a NEW event, not an edit — assign then unassign leaves the slot empty", () => {
    const s = deriveState([
      ev(1, "SHIFT_DEFINED", { shiftId: "S9", date: "2026-08-22", start: "08:00", end: "12:00", requiredHeadcount: 1 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S9", employeeId: "EX" }),
      ev(3, "EMPLOYEE_UNASSIGNED", { shiftId: "S9", employeeId: "EX" }),
    ]);
    expect(s.shifts["S9"]?.assigned).toEqual([]);
  });

  it("SHIFT_CANCELLED tombstones the shift — it and its assignments drop from derived state", () => {
    const s = deriveState([
      ev(1, "SHIFT_DEFINED", { shiftId: "SC", date: "2026-08-25", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "SC", employeeId: "E4" }),
      ev(3, "SHIFT_CANCELLED", { shiftId: "SC" }),
    ]);
    expect(s.shifts["SC"]).toBeUndefined();
  });

  it("a SHIFT_DEFINED after a SHIFT_CANCELLED for the same id re-creates the shift (fresh definition)", () => {
    const s = deriveState([
      ev(1, "SHIFT_DEFINED", { shiftId: "SR", date: "2026-08-26", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "SHIFT_CANCELLED", { shiftId: "SR" }),
      ev(3, "SHIFT_DEFINED", { shiftId: "SR", date: "2026-08-26", start: "10:00", end: "18:00", requiredHeadcount: 2 }),
    ]);
    expect(s.shifts["SR"]).toMatchObject({ start: "10:00", requiredHeadcount: 2, assigned: [] });
  });

  it("re-defining a shift preserves its assignments + publish status (a definition edit, not a reset)", () => {
    const s = deriveState([
      ev(1, "SHIFT_DEFINED", { shiftId: "S2", date: "2026-08-23", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S2", employeeId: "E7" }),
      ev(3, "SHIFT_PUBLISHED", { shiftId: "S2" }),
      ev(4, "SHIFT_DEFINED", { shiftId: "S2", date: "2026-08-23", start: "10:00", end: "18:00", requiredHeadcount: 2 }),
    ]);
    expect(s.shifts["S2"]).toMatchObject({ start: "10:00", requiredHeadcount: 2, assigned: ["E7"], status: "published" });
  });

  it("SWAP_APPROVED reassigns; SWAP_REQUESTED does not touch assignments", () => {
    const base: ScheduleEvent[] = [
      ev(1, "SHIFT_DEFINED", { shiftId: "S3", date: "2026-08-24", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S3", employeeId: "EA" }),
    ];
    const requestedOnly = deriveState([...base, ev(3, "SWAP_REQUESTED", { shiftId: "S3", fromEmployeeId: "EA", toEmployeeId: "EB" })]);
    expect(requestedOnly.shifts["S3"]?.assigned).toEqual(["EA"]); // pending swap = no change
    const approved = deriveState([...base, ev(3, "SWAP_APPROVED", { shiftId: "S3", fromEmployeeId: "EA", toEmployeeId: "EB" })]);
    expect(approved.shifts["S3"]?.assigned).toEqual(["EB"]);
  });

  it("AVAILABILITY_SET replaces wholesale; COVERAGE_REQ_CHANGED patches an existing requirement", () => {
    const s = deriveState([
      ev(1, "AVAILABILITY_SET", { employeeId: "E5", weekly: [{ dayOfWeek: 1, from: "09:00", to: "17:00" }], unavailableDates: ["2026-08-25"] }),
      ev(2, "AVAILABILITY_SET", { employeeId: "E5", weekly: [{ dayOfWeek: 2, from: "10:00", to: "14:00" }] }),
      ev(3, "COVERAGE_REQ_DEFINED", { requirementId: "R1", appliesTo: "day", minHeadcount: 3 }),
      ev(4, "COVERAGE_REQ_CHANGED", { requirementId: "R1", minHeadcount: 5 }),
    ]);
    expect(s.availability["E5"]).toEqual({ employeeId: "E5", weekly: [{ dayOfWeek: 2, from: "10:00", to: "14:00" }], unavailableDates: [] });
    expect(s.coverageReqs["R1"]).toMatchObject({ appliesTo: "day", minHeadcount: 5 }); // patched, appliesTo preserved
  });

  it("COVERAGE_REQ_REMOVED deletes a requirement (a manager fixing a mistaken rule)", () => {
    const s = deriveState([
      ev(1, "COVERAGE_REQ_DEFINED", { requirementId: "R1", appliesTo: "day", minHeadcount: 3 }),
      ev(2, "COVERAGE_REQ_DEFINED", { requirementId: "R2", appliesTo: "shift", minHeadcount: 2 }),
      ev(3, "COVERAGE_REQ_REMOVED", { requirementId: "R1" }),
    ]);
    expect(s.coverageReqs["R1"]).toBeUndefined(); // removed
    expect(s.coverageReqs["R2"]).toMatchObject({ minHeadcount: 2 }); // the other is untouched
  });

  it("SHIFT_UNPUBLISHED drafts a shift; TIMEOFF_DENIED denies; SWAP_REQUESTED leaves assignments unchanged", () => {
    // Locks the projector branches the other tests skipped. SWAP_REQUESTED is a pending signal only — it must
    // NOT move anyone (only SWAP_APPROVED reassigns).
    const s = deriveState([
      ev(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: "A" }),
      ev(3, "SHIFT_PUBLISHED", { shiftId: "S1" }),
      ev(4, "SHIFT_UNPUBLISHED", { shiftId: "S1" }),
      ev(5, "TIMEOFF_REQUESTED", { timeOffId: "T1", employeeId: "A", type: "sick", start: "2026-08-25", end: "2026-08-25" }),
      ev(6, "TIMEOFF_DENIED", { timeOffId: "T1" }),
      ev(7, "SWAP_REQUESTED", { shiftId: "S1", fromEmployeeId: "A", toEmployeeId: "B" }),
    ]);
    expect(s.shifts["S1"]?.status).toBe("draft"); // unpublished → draft
    expect(s.shifts["S1"]?.assigned).toEqual(["A"]); // SWAP_REQUESTED did not reassign
    expect(s.timeOff["T1"]?.status).toBe("denied");
  });

  it("is robust: an unknown event type and a malformed payload are no-ops (replay survives)", () => {
    const s = deriveState([
      ev(1, "SHIFT_DEFINED", { shiftId: "S4", date: "2026-08-26", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
      ev(2, "TOTALLY_UNKNOWN" as ScheduleEventType, { anything: true }),
      ev(3, "EMPLOYEE_ASSIGNED", { shiftId: "S4" }), // malformed: no employeeId
    ]);
    expect(s.shifts["S4"]?.assigned).toEqual([]);
    expect(Object.keys(s.shifts)).toEqual(["S4"]);
  });

  it("does not mutate the input array (pure)", () => {
    const input = [...LOG];
    const snapshot = input.map((e) => e.seq);
    deriveState(input);
    expect(input.map((e) => e.seq)).toEqual(snapshot);
  });
});
