import { describe, it, expect } from "vitest";
import { personalSchedule } from "../personalSchedule";
import type { ScheduleState, Shift, TimeOff } from "../types";

function shift(p: Partial<Shift> & { id: string; date: string; assigned: string[] }): Shift {
  return {
    start: "09:00",
    end: "17:00",
    requiredHeadcount: 1,
    requiredByRole: {},
    status: "draft",
    ...p,
  };
}

function state(shifts: Shift[], timeOff: TimeOff[] = []): ScheduleState {
  return {
    shifts: Object.fromEntries(shifts.map((s) => [s.id, s])),
    timeOff: Object.fromEntries(timeOff.map((t) => [t.id, t])),
    availability: {},
    coverageReqs: {},
  };
}

describe("personalSchedule", () => {
  it("returns only the employee's own shifts from fromDate onward, chronologically", () => {
    const st = state([
      shift({ id: "s1", date: "2026-08-25", assigned: ["emp1"] }),
      shift({ id: "s2", date: "2026-08-20", assigned: ["emp1"] }), // before fromDate → excluded
      shift({ id: "s3", date: "2026-08-22", assigned: ["emp2"] }), // other employee → excluded
      shift({ id: "s4", date: "2026-08-22", start: "07:00", assigned: ["emp1"] }),
    ]);
    const r = personalSchedule(st, "emp1", "2026-08-21");
    expect(r.upcoming.map((s) => s.id)).toEqual(["s4", "s1"]); // 08-22 before 08-25
  });

  it("sorts same-day shifts by start time and computes hours + total", () => {
    const st = state([
      shift({ id: "a", date: "2026-08-25", start: "13:00", end: "17:00", assigned: ["emp1"] }),
      shift({ id: "b", date: "2026-08-25", start: "08:00", end: "12:00", assigned: ["emp1"] }),
    ]);
    const r = personalSchedule(st, "emp1", "2026-08-25");
    expect(r.upcoming.map((s) => s.id)).toEqual(["b", "a"]);
    expect(r.upcoming[0]!.hours).toBe(4);
    expect(r.totalHours).toBe(8);
  });

  it("includes only APPROVED time off that reaches into the window", () => {
    const st = state(
      [],
      [
        { id: "t1", employeeId: "emp1", type: "vacation", start: "2026-08-24", end: "2026-08-26", partial: false, status: "approved" },
        { id: "t2", employeeId: "emp1", type: "sick", start: "2026-08-24", end: "2026-08-26", partial: false, status: "requested" }, // pending → excluded
        { id: "t3", employeeId: "emp1", type: "personal", start: "2026-08-01", end: "2026-08-02", partial: false, status: "approved" }, // ends before window → excluded
        { id: "t4", employeeId: "emp2", type: "vacation", start: "2026-08-24", end: "2026-08-26", partial: false, status: "approved" }, // other employee → excluded
      ],
    );
    const r = personalSchedule(st, "emp1", "2026-08-21");
    expect(r.approvedTimeOff.map((t) => t.type)).toEqual(["vacation"]);
  });

  it("surfaces the published flag per shift (drift-guard: no published-only filter yet)", () => {
    const st = state([
      shift({ id: "d", date: "2026-08-25", assigned: ["emp1"], status: "draft" }),
      shift({ id: "p", date: "2026-08-26", assigned: ["emp1"], status: "published" }),
    ]);
    const r = personalSchedule(st, "emp1", "2026-08-25");
    // BOTH show — draft shifts are the schedule until a publish UI exists. If that changes, this
    // test should flip to asserting the draft is filtered out.
    expect(r.upcoming.map((s) => s.published)).toEqual([false, true]);
  });

  it("includes an overnight shift that started the day before fromDate (still in progress today)", () => {
    const st = state([
      shift({ id: "night", date: "2026-08-20", start: "22:00", end: "06:00", assigned: ["emp1"] }), // runs into 08-21
      shift({ id: "old", date: "2026-08-19", start: "22:00", end: "06:00", assigned: ["emp1"] }), // ends 08-20, before window
      shift({ id: "day", date: "2026-08-20", start: "09:00", end: "17:00", assigned: ["emp1"] }), // same-day, ends before window
    ]);
    const r = personalSchedule(st, "emp1", "2026-08-21");
    expect(r.upcoming.map((s) => s.id)).toEqual(["night"]); // only the overnight one still running into 08-21
  });

  it("is empty (not throwing) for an employee with nothing scheduled", () => {
    const r = personalSchedule(state([]), "nobody", "2026-08-21");
    expect(r).toEqual({ upcoming: [], approvedTimeOff: [], totalHours: 0 });
  });
});
