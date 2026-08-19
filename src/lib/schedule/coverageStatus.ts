/**
 * Schedule Management System — proactive coverage-gap finder (Phase 5 completion).
 *
 * The time-off review flow surfaces coverage impact REACTIVELY (for a proposed change). This computes the
 * gaps that exist RIGHT NOW: which built/imported shifts are understaffed against their floor. Pure +
 * deterministic; reuses the SAME building blocks as the authority so the two can't disagree —
 * `buildEvalContext` (requirementForShift: coverage requirements + the shift's own requiredHeadcount, RQ22),
 * `meetsCoverage`, and `shiftHitsApprovedTimeOff` (an approved-off person doesn't cover the shift, RQ15).
 */
import { buildEvalContext } from "./evalContext";
import { meetsCoverage, type CoverageGap } from "./constraints";
import { shiftHitsApprovedTimeOff } from "./authority";
import type { ScheduleEvent, Employee } from "./types";

export interface ShiftCoverageGap {
  shiftId: string;
  date: string;
  start: string;
  end: string;
  assigned: number; // PRESENT headcount (excludes anyone on approved time-off)
  gaps: CoverageGap[]; // what's short (headcount and/or per-role)
}

/**
 * Every currently-understaffed shift, earliest first. A shift with no coverage floor (no requirement AND
 * requiredHeadcount 0) is never a gap. Only PRESENT staff count (an approved-off assignee doesn't cover).
 */
export function findCoverageGaps(events: ScheduleEvent[], employees: Employee[]): ShiftCoverageGap[] {
  const ctx = buildEvalContext({ events, employees });
  const roleOf = (id: string): string | null => ctx.employees[id]?.role ?? null;
  const out: ShiftCoverageGap[] = [];
  for (const shift of Object.values(ctx.state.shifts)) {
    const req = ctx.requirementForShift(shift.id);
    if (!req) continue;
    const present = shift.assigned.filter((id) => !shiftHitsApprovedTimeOff(ctx.state, id, shift));
    const res = meetsCoverage({ assigned: present }, req, roleOf);
    if (!res.meets) {
      out.push({ shiftId: shift.id, date: shift.date, start: shift.start, end: shift.end, assigned: present.length, gaps: res.gaps });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
