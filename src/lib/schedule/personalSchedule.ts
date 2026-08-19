import type { ScheduleState } from "./types";
import { shiftDurationHours } from "./constraints";

/**
 * Schedule Management System — Phase 6 (§1.5.1 layers 3–4), "no login yet" model.
 *
 * One employee's OWN schedule, derived from the shared ScheduleState. The founder chose the
 * manager-entered model (2026-08-20): employees do not log in; a manager pulls up / prints an
 * employee's schedule. This projector answers "what does one person's schedule look like?" over
 * the same derived state the rest of the module reads — a pure function, no new source of truth.
 *
 * It shows every non-cancelled shift assigned to the employee from `fromDate` onward. It does NOT
 * filter to `published`: the module has no publish UI yet, so every shift is `draft`, and Grid /
 * Coverage already treat a DEFINED shift as the schedule. Filtering to published here would make
 * the personal view a permanent empty dead-end (§1.5.1 layer 3). `published` is surfaced per-shift
 * so the day a publish step ships, the view can distinguish the two — see personalSchedule.test.ts
 * (drift-guard: if a publish UI lands, add a published-only filter + flip that test).
 */

export interface PersonalShift {
  id: string;
  date: string; // ISO YYYY-MM-DD
  start: string; // HH:mm
  end: string;
  hours: number;
  published: boolean;
}

export interface PersonalTimeOff {
  type: string;
  start: string;
  end: string;
}

export interface PersonalSchedule {
  upcoming: PersonalShift[];
  approvedTimeOff: PersonalTimeOff[];
  totalHours: number; // sum of upcoming shift hours — an informational at-a-glance total
}

export function personalSchedule(state: ScheduleState, employeeId: string, fromDate: string): PersonalSchedule {
  const upcoming: PersonalShift[] = Object.values(state.shifts)
    .filter((s) => s.assigned.includes(employeeId) && s.date >= fromDate)
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)))
    .map((s) => ({
      id: s.id,
      date: s.date,
      start: s.start,
      end: s.end,
      hours: shiftDurationHours(s.start, s.end),
      published: s.status === "published",
    }));

  const approvedTimeOff: PersonalTimeOff[] = Object.values(state.timeOff)
    .filter((t) => t.employeeId === employeeId && t.status === "approved" && t.end >= fromDate)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((t) => ({ type: t.type, start: t.start, end: t.end }));

  const totalHours = upcoming.reduce((sum, s) => sum + s.hours, 0);
  return { upcoming, approvedTimeOff, totalHours };
}
