import type { Shift, Employee } from "./types";
import { shiftDurationHours } from "./constraints";

/**
 * Schedule Management System — Phase 7 (§3.6 make-learning-visible), foundation. Surfaces PATTERNS a manager
 * might miss, computed DETERMINISTICALLY from the current schedule. It is framed honestly as "current
 * patterns", NOT as longitudinal "learning" the System has validated over time (§3.4 / §4 — claiming
 * unvalidated learning is the honesty-thesis failure). Longitudinal outcome-tracking is the next Phase-7 step;
 * this is the honest, buildable-now first cut: who is carrying the most hours (over-reliance / burnout risk),
 * and who is on the roster but unused. Pure + unit-tested.
 */

export interface StaffHours {
  employeeId: string;
  name: string;
  hours: number;
}

export interface ScheduleInsights {
  /** Active staff (with any upcoming shift) by hours this period, most-loaded first. */
  hoursByStaff: StaffHours[];
  /** The most-loaded staffer IF they carry notably more than the average (>= 1.4x, and >= 3 staff working) —
   *  an over-reliance / burnout signal the manager may want to rebalance. Null when load is even or too few. */
  overReliance: StaffHours | null;
  /** Active staff with NO upcoming shift — underused, or forgotten. */
  unusedStaff: string[];
  totalUpcomingShifts: number;
  activeStaff: number;
}

/**
 * @param fromDate  ISO "today" — only shifts on/after it count (the forward-looking picture).
 */
export function scheduleInsights(shifts: Shift[], employees: Employee[], fromDate: string): ScheduleInsights {
  const active = employees.filter((e) => e.status === "active");
  const byId = new Map(active.map((e) => [e.id, e]));
  const hours = new Map<string, number>();
  active.forEach((e) => hours.set(e.id, 0));

  const upcoming = shifts.filter((s) => s.date >= fromDate);
  for (const s of upcoming) {
    const dur = shiftDurationHours(s.start, s.end);
    for (const empId of s.assigned) {
      if (hours.has(empId)) hours.set(empId, (hours.get(empId) ?? 0) + dur);
    }
  }

  const hoursByStaff: StaffHours[] = [...hours.entries()]
    .filter(([, h]) => h > 0)
    .map(([employeeId, h]) => ({ employeeId, name: byId.get(employeeId)?.name ?? employeeId, hours: Math.round(h * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));

  const working = hoursByStaff.length;
  const avg = working > 0 ? hoursByStaff.reduce((s, x) => s + x.hours, 0) / working : 0;
  const top = hoursByStaff[0] ?? null;
  const overReliance = top && working >= 3 && avg > 0 && top.hours >= avg * 1.4 ? top : null;

  const unusedStaff = active
    .filter((e) => (hours.get(e.id) ?? 0) === 0)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  return { hoursByStaff, overReliance, unusedStaff, totalUpcomingShifts: upcoming.length, activeStaff: active.length };
}
