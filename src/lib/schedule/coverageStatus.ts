/**
 * Schedule Management System — proactive coverage-gap finder (Phase 5 completion).
 *
 * The time-off review flow surfaces coverage impact REACTIVELY (for a proposed change). This computes the
 * gaps that exist RIGHT NOW: which built/imported shifts are understaffed against their floor. Pure +
 * deterministic; reuses the SAME building blocks as the authority so the two can't disagree —
 * `buildEvalContext` (requirementForShift: coverage requirements + the shift's own requiredHeadcount, RQ22),
 * `meetsCoverage`, and `shiftHitsApprovedTimeOff` (an approved-off person doesn't cover the shift, RQ15).
 */
import { meetsCoverage, type CoverageGap } from "./constraints";
import { shiftHitsApprovedTimeOff, type EvalContext } from "./authority";

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
 * Takes a pre-built EvalContext so the caller derives state ONCE (the route reuses it for the requirements
 * list too — no double replay).
 *
 * `fromDate` (YYYY-MM-DD, optional): skip shifts before it — a manager can't act on a PAST understaffed
 * shift, so including them is just noise that grows as the log accumulates. The caller passes "today"; the
 * exact day boundary is tz-approximate until `companies.timezone` lands (RQ4).
 */
export function findCoverageGaps(ctx: EvalContext, fromDate?: string): ShiftCoverageGap[] {
  const roleOf = (id: string): string | null => ctx.employees[id]?.role ?? null;
  const out: ShiftCoverageGap[] = [];
  for (const shift of Object.values(ctx.state.shifts)) {
    if (fromDate && shift.date < fromDate) continue; // past shift — not actionable
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
