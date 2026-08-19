import type { Shift, Employee } from "./types";

/**
 * Pure view logic for the weekly schedule grid, extracted from the client component so it can be unit-tested
 * (the pivot, the relevance filter, and the per-cell lookup are real logic that has already had a bug — the
 * inactive-staff accumulation filter). The component is left as thin wiring over these.
 */

export interface WeekCell {
  shiftId: string;
  /** "HH:mm-HH:mm" for display. */
  label: string;
  /** The assigned person has APPROVED time-off overlapping this date — so they won't actually work it. The
   *  grid shows the assignment; without this flag it looks staffed while Coverage (RQ15) flags it short. */
  off?: boolean;
}

/** Approved time-off spans (for marking assigned-but-off cells). */
export interface ApprovedOff {
  employeeId: string;
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

export interface WeekGrid {
  /** The shift a given employee works on a given date in the displayed week, or null. */
  cell: (employeeId: string, date: string) => WeekCell | null;
  /** Employee ids with at least one shift in the displayed week. */
  scheduledIds: Set<string>;
  /** How many shifts fall in the displayed week (for the "no shifts this week" hint). */
  shiftsThisWeek: number;
  /** Shifts in the displayed week with NOBODY assigned. The grid pivots by assignment, so these render NO
   *  cells — they'd be invisible ghosts (yet counted, and flagged by Coverage). Surfaced so the manager can
   *  see + act on them instead of a confusing empty-looking grid. */
  emptyShiftsThisWeek: number;
}

/**
 * Pivot the derived shifts into an employee×date lookup for ONE week. A shift is included only if its date is
 * one of `dates` (the displayed week). Each cell carries the shiftId so a click can unassign that person from
 * THAT shift. A shift with N assignees produces N cells (one per person).
 */
export function buildWeekGrid(shifts: Shift[], dates: string[], approvedOff: ApprovedOff[] = []): WeekGrid {
  const inWeek = new Set(dates);
  // Is employee `e` on approved time-off on date `d`? (inclusive span). Small n — a linear scan is fine.
  const isOff = (e: string, d: string) => approvedOff.some((t) => t.employeeId === e && t.start <= d && d <= t.end);
  const byEmpDate = new Map<string, Map<string, WeekCell>>();
  let shiftsThisWeek = 0;
  let emptyShiftsThisWeek = 0;
  for (const s of shifts) {
    if (!inWeek.has(s.date)) continue;
    shiftsThisWeek += 1;
    if (s.assigned.length === 0) emptyShiftsThisWeek += 1; // no cells rendered for this shift — surface it
    for (const empId of s.assigned) {
      if (!byEmpDate.has(empId)) byEmpDate.set(empId, new Map());
      byEmpDate.get(empId)!.set(s.date, { shiftId: s.id, label: `${s.start}-${s.end}`, off: isOff(empId, s.date) });
    }
  }
  return {
    cell: (employeeId, date) => byEmpDate.get(employeeId)?.get(date) ?? null,
    scheduledIds: new Set(byEmpDate.keys()),
    shiftsThisWeek,
    emptyShiftsThisWeek,
  };
}

/**
 * The staff rows worth showing: active staff, plus anyone actually working the displayed week (a staff member
 * deactivated AFTER being assigned still shows). Deactivated-and-unscheduled staff are hidden so their empty
 * rows don't pile up over time (the accumulation class the past-shift / past-time-off filters also address).
 */
export function relevantRows(roster: Employee[], scheduledIds: Set<string>): Employee[] {
  return roster.filter((e) => e.status === "active" || scheduledIds.has(e.id));
}
