/**
 * Schedule Management System — the single decision authority (Phase 3, A40 / §2.2 — "the money rule").
 *
 * `evaluateChange(change, ctx) → Verdict` is the ONE place the coverage/eligibility decision is computed.
 * Every consumer (the manager UI, the employee status page, the Phase-4 auto-approve path) branches on
 * the returned Verdict — none re-derives coverage/eligibility from raw shifts. Two copies of this
 * condition would drift and a dropped term would silently defeat the gate (A40). It is DETERMINISTIC:
 * it composes the pure Phase-2 predicates + the state-dependent checks; the LLM (Phase 4) never
 * overrides it.
 *
 * Founder decisions embodied (2026-08-19):
 *   - coverage minimum is BLOCK-BY-DEFAULT but MANAGER-OVERRIDABLE → a coverage shortfall is an
 *     `overridable` violation (not auto-approvable, but the manager may approve anyway). An ABSOLUTE
 *     violation (ineligible / double-booked / working during approved time-off / over the hours cap)
 *     is never approvable — a person cannot be in two places, work a shift they are off for, or exceed
 *     a hard cap.
 *   - a ZERO-IMPACT change (no violation of any kind) is `autoApprovable`.
 */
import type { ScheduleState, Employee } from "./types";
import { meetsCoverage, isEligible, withinLimits, shiftDurationHours, weeklyHoursOf, rangesOverlap, crossesMidnight, addDaysIso, type CoverageGap } from "./constraints";

export type Change =
  | { kind: "time_off"; employeeId: string; start: string; end: string } // inclusive date range YYYY-MM-DD
  | { kind: "assign"; shiftId: string; employeeId: string }
  | { kind: "unassign"; shiftId: string; employeeId: string }
  | { kind: "swap"; shiftId: string; fromEmployeeId: string; toEmployeeId: string };

export type HardViolation =
  | { kind: "coverage"; shiftId: string; gaps: CoverageGap[]; overridable: true }
  | { kind: "ineligible"; shiftId: string; employeeId: string; overridable: false }
  | { kind: "double_booked"; shiftId: string; employeeId: string; overridable: false }
  | { kind: "time_off_conflict"; shiftId: string; employeeId: string; overridable: false }
  | { kind: "over_hours"; employeeId: string; overBy: number; overridable: false };

export interface Verdict {
  /** No ABSOLUTE violations — the change may be approved (possibly WITH a manager override of coverage gaps). */
  approvable: boolean;
  /** No violation of ANY kind — safe to auto-approve (founder: auto-approve zero-impact). */
  autoApprovable: boolean;
  violations: HardViolation[];
  affectedShifts: string[];
  reason: string;
}

/** Everything the authority needs, all derived (state) or roster (employees). The caller assembles this
 *  ONCE; the authority never reads the DB itself (keeps it pure + testable). */
export interface EvalContext {
  state: ScheduleState;
  employees: Record<string, Employee>; // keyed by employee id
  /** The coverage requirement that applies to a shift, or null if none. Kept as a lookup so the
   *  authority stays agnostic to how requirements map to shifts (day/shift/role — that mapping is the
   *  caller's, so this one authority isn't coupled to it). */
  requirementForShift: (shiftId: string) => { minHeadcount: number; minByRole: Record<string, number> } | null;
  /** Day the workweek starts (JS 0=Sun..6=Sat) for the weekly-hours cap — a company setting (RQ7, 0224).
   *  Optional: absent → Monday (1), the prior default, so existing callers/tests are unaffected. */
  weekStartDay?: number;
}

const roleOfFrom = (employees: Record<string, Employee>) => (id: string): string | null =>
  employees[id]?.role ?? null;

/** Does an employee have an APPROVED time-off overlapping a given date? */
function hasApprovedTimeOffOn(state: ScheduleState, employeeId: string, date: string): boolean {
  for (const t of Object.values(state.timeOff)) {
    if (t.employeeId === employeeId && t.status === "approved" && date >= t.start && date <= t.end) return true;
  }
  return false;
}

/**
 * Does a shift's FULL SPAN fall on an employee's approved time-off? A shift is checked on its start date,
 * AND — if it crosses midnight (an overnight shift) — on the next calendar day too, since that shift also
 * occupies the morning after. Checking only the start date would let someone be assigned to an overnight
 * shift that runs into a day they're approved off (the VA schedules have overnight shifts). Span-based, tz
 * independent (uses the shift's own local dates).
 */
export function shiftHitsApprovedTimeOff(state: ScheduleState, employeeId: string, shift: { date: string; start: string; end: string }): boolean {
  if (hasApprovedTimeOffOn(state, employeeId, shift.date)) return true;
  if (crossesMidnight(shift.start, shift.end)) {
    const next = addDaysIso(shift.date, 1);
    if (next && hasApprovedTimeOffOn(state, employeeId, next)) return true;
  }
  return false;
}

function verdictOf(violations: HardViolation[], affectedShifts: string[]): Verdict {
  const absolute = violations.filter((v) => v.overridable === false);
  const approvable = absolute.length === 0;
  const autoApprovable = violations.length === 0;
  const reason = autoApprovable
    ? "No coverage impact and no conflicts — safe to approve automatically."
    : absolute.length > 0
      ? `Blocked by ${absolute.length} hard conflict(s): ${absolute.map((v) => v.kind).join(", ")}.`
      : `Approvable with a manager override — ${violations.length} coverage shortfall(s) would result.`;
  return { approvable, autoApprovable, violations, affectedShifts, reason };
}

/**
 * The single authority. Given a proposed change + the current derived state and roster, return the
 * Verdict. No writes, no LLM, no re-derivation elsewhere.
 */
export function evaluateChange(change: Change, ctx: EvalContext): Verdict {
  const { state, employees } = ctx;
  const roleOf = roleOfFrom(employees);
  const violations: HardViolation[] = [];
  const affected = new Set<string>();

  const coverageAfter = (shiftId: string, assigned: string[]) => {
    const req = ctx.requirementForShift(shiftId);
    if (!req) return; // no requirement → no coverage floor to breach
    // Count only employees actually PRESENT: someone assigned but on APPROVED time-off does not cover the
    // shift (approving time-off does NOT auto-unassign them). Without this the coverage check OVERCOUNTS a
    // colleague who is already off, so a manager could approve overlapping time-off that understaffs a shift
    // with no warning. Span-aware (RQ10) — an overnight shift running into an off day counts them absent too.
    const shift = state.shifts[shiftId];
    const present = shift ? assigned.filter((id) => !shiftHitsApprovedTimeOff(state, id, shift)) : assigned;
    const res = meetsCoverage({ assigned: present }, req, roleOf);
    if (!res.meets) violations.push({ kind: "coverage", shiftId, gaps: res.gaps, overridable: true });
  };

  switch (change.kind) {
    case "time_off": {
      // Removing the requester from every shift they're assigned to within the date range → check coverage.
      for (const s of Object.values(state.shifts)) {
        if (s.date >= change.start && s.date <= change.end && s.assigned.includes(change.employeeId)) {
          affected.add(s.id);
          coverageAfter(s.id, s.assigned.filter((id) => id !== change.employeeId));
        }
      }
      break;
    }
    case "assign": {
      const shift = state.shifts[change.shiftId];
      const emp = employees[change.employeeId];
      if (!shift || !emp) {
        return verdictOf([], []); // nothing to evaluate against; caller validated existence upstream
      }
      affected.add(shift.id);
      // eligibility (role/skill/cert + active)
      if (!isEligible(emp, { role: shift.requiredByRole && Object.keys(shift.requiredByRole).length === 1 ? Object.keys(shift.requiredByRole)[0] : null })) {
        violations.push({ kind: "ineligible", shiftId: shift.id, employeeId: emp.id, overridable: false });
      }
      // double-booking: already on another shift the same date whose time OVERLAPS this one. A same-date
      // check alone would wrongly block legitimate split shifts (e.g. 10:00–14:00 AND 19:00–23:00 — common
      // in the VA schedules); the real constraint is a TIME clash ("can't be in two places at once").
      const clash = Object.values(state.shifts).some(
        (o) =>
          o.id !== shift.id &&
          o.date === shift.date &&
          o.assigned.includes(emp.id) &&
          rangesOverlap(o.start, o.end, shift.start, shift.end),
      );
      if (clash) violations.push({ kind: "double_booked", shiftId: shift.id, employeeId: emp.id, overridable: false });
      // no assignment during approved time-off (span-aware: an overnight shift also occupies the next day)
      if (shiftHitsApprovedTimeOff(state, emp.id, shift)) {
        violations.push({ kind: "time_off_conflict", shiftId: shift.id, employeeId: emp.id, overridable: false });
      }
      // hours cap (their current hours THAT WEEK + this shift; week bucketed on the company workweek-start)
      const proposed = weeklyHoursOf(state, emp.id, shift.date, ctx.weekStartDay ?? 1) + shiftDurationHours(shift.start, shift.end);
      const lim = withinLimits(emp, proposed);
      if (!lim.within) violations.push({ kind: "over_hours", employeeId: emp.id, overBy: lim.overBy, overridable: false });
      break;
    }
    case "unassign": {
      const shift = state.shifts[change.shiftId];
      if (shift) {
        affected.add(shift.id);
        coverageAfter(shift.id, shift.assigned.filter((id) => id !== change.employeeId));
      }
      break;
    }
    case "swap": {
      // Evaluate the swap as: the to-employee takes the from-employee's slot on this shift.
      const shift = state.shifts[change.shiftId];
      const to = employees[change.toEmployeeId];
      if (shift && to) {
        affected.add(shift.id);
        const after = shift.assigned.filter((id) => id !== change.fromEmployeeId).concat(to.id);
        if (!isEligible(to, { role: shift.requiredByRole && Object.keys(shift.requiredByRole).length === 1 ? Object.keys(shift.requiredByRole)[0] : null })) {
          violations.push({ kind: "ineligible", shiftId: shift.id, employeeId: to.id, overridable: false });
        }
        if (shiftHitsApprovedTimeOff(state, to.id, shift)) {
          violations.push({ kind: "time_off_conflict", shiftId: shift.id, employeeId: to.id, overridable: false });
        }
        // double-booking: the to-employee is already on another shift the same date whose time OVERLAPS.
        // Mirrors the assign path (RQ9) — every assignment-creating path must reject a time clash (A26).
        const swapClash = Object.values(state.shifts).some(
          (o) => o.id !== shift.id && o.date === shift.date && o.assigned.includes(to.id) && rangesOverlap(o.start, o.end, shift.start, shift.end),
        );
        if (swapClash) violations.push({ kind: "double_booked", shiftId: shift.id, employeeId: to.id, overridable: false });
        const proposed = weeklyHoursOf(state, to.id, shift.date, ctx.weekStartDay ?? 1) + shiftDurationHours(shift.start, shift.end);
        const lim = withinLimits(to, proposed);
        if (!lim.within) violations.push({ kind: "over_hours", employeeId: to.id, overBy: lim.overBy, overridable: false });
        coverageAfter(shift.id, after);
      }
      break;
    }
  }

  return verdictOf(violations, [...affected]);
}
