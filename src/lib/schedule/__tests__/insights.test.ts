import { describe, it, expect } from "vitest";
import { scheduleInsights } from "../insights";
import type { Shift, Employee } from "../types";

const shift = (id: string, date: string, start: string, end: string, assigned: string[]): Shift =>
  ({ id, date, start, end, requiredHeadcount: 1, requiredByRole: {}, assigned, status: "published" });
const emp = (id: string, status: "active" | "inactive" = "active"): Employee =>
  ({ id, name: id, role: null, employmentType: null, skills: [], certifications: [], maxHoursWeek: null, minHoursWeek: null, status } as unknown as Employee);

describe("scheduleInsights (Phase 7 current-patterns)", () => {
  it("sums UPCOMING hours per active staff, most-loaded first; ignores past + inactive", () => {
    const shifts = [
      shift("s1", "2026-09-01", "09:00", "17:00", ["a"]), // 8h a
      shift("s2", "2026-09-02", "09:00", "17:00", ["a", "b"]), // 8h a, 8h b
      shift("s3", "2026-08-01", "09:00", "17:00", ["b"]), // PAST → ignored
    ];
    const r = scheduleInsights(shifts, [emp("a"), emp("b"), emp("c"), emp("z", "inactive")], "2026-08-20");
    expect(r.hoursByStaff).toEqual([
      { employeeId: "a", name: "a", hours: 16 },
      { employeeId: "b", name: "b", hours: 8 },
    ]);
    expect(r.unusedStaff).toEqual(["c"]); // active, no upcoming shift
    expect(r.totalUpcomingShifts).toBe(2);
    expect(r.activeStaff).toBe(3);
  });

  it("flags over-reliance only when the top carries >= 1.4x average with 3+ working", () => {
    // a=24, b=8, c=8 → avg ~13.3, a >= 1.4*avg → over-reliance
    const heavy = [
      shift("s1", "2026-09-01", "00:00", "08:00", ["a"]), shift("s2", "2026-09-02", "00:00", "08:00", ["a"]), shift("s3", "2026-09-03", "00:00", "08:00", ["a"]),
      shift("s4", "2026-09-01", "09:00", "17:00", ["b"]), shift("s5", "2026-09-01", "09:00", "17:00", ["c"]),
    ];
    expect(scheduleInsights(heavy, [emp("a"), emp("b"), emp("c")], "2026-08-20").overReliance?.name).toBe("a");

    // even load → no over-reliance
    const even = [shift("s1", "2026-09-01", "09:00", "17:00", ["a"]), shift("s2", "2026-09-01", "09:00", "17:00", ["b"]), shift("s3", "2026-09-01", "09:00", "17:00", ["c"])];
    expect(scheduleInsights(even, [emp("a"), emp("b"), emp("c")], "2026-08-20").overReliance).toBeNull();
  });

  it("is empty-safe (no shifts / no staff)", () => {
    const r = scheduleInsights([], [], "2026-08-20");
    expect(r).toEqual({ hoursByStaff: [], overReliance: null, unusedStaff: [], totalUpcomingShifts: 0, activeStaff: 0 });
  });
});
