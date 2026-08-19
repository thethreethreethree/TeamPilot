import { evaluateChange, type EvalContext, type HardViolation } from "./authority";
import { findResolutions, type ResolutionCandidate } from "./resolution";
import type { Shift } from "./types";

/**
 * Conflict-check for ASSIGNING staff to a shift — the plan's "AI evaluates changes and surfaces impact",
 * wired for the primary flow (Build). The authority already checks an assignment (double-booking, over-hours,
 * ineligibility, approved time-off); this reuses it for a PROPOSED (not-yet-created) shift by injecting the
 * shift into a hypothetical state, so the manager sees conflicts BEFORE committing instead of blindly creating
 * an unworkable assignment. Pure — the caller assembles the EvalContext.
 */

export interface ProposedShift {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  requiredHeadcount: number;
  requiredByRole?: Record<string, number>;
}

export interface AssignmentImpact {
  employeeId: string;
  /** Per-employee absolute conflicts (double_booked / time_off_conflict / over_hours / ineligible). Coverage
   *  (a shift-level, overridable concern) is intentionally excluded — it's surfaced by the coverage-gaps view. */
  violations: HardViolation[];
}

const TEMP_ID = "__proposed__";

export function evaluateAssignments(base: EvalContext, shift: ProposedShift, employeeIds: string[]): AssignmentImpact[] {
  const hypo: Shift = {
    id: TEMP_ID,
    date: shift.date,
    start: shift.start,
    end: shift.end,
    requiredHeadcount: shift.requiredHeadcount,
    requiredByRole: shift.requiredByRole ?? {},
    assigned: [],
    status: "draft",
  };
  const ctx: EvalContext = { ...base, state: { ...base.state, shifts: { ...base.state.shifts, [TEMP_ID]: hypo } } };
  return employeeIds.map((employeeId) => {
    const verdict = evaluateChange({ kind: "assign", shiftId: TEMP_ID, employeeId }, ctx);
    return { employeeId, violations: verdict.violations.filter((v) => v.kind !== "coverage") };
  });
}

/**
 * Suggest staff for a PROPOSED shift — the plan's "AI proposes", wired for the Build create flow (was only
 * wired for time-off). Reuses `findResolutions` (eligible + no absolute conflict + fair-load ranked) by
 * injecting the proposed shift into a hypothetical state, so a manager filling a shift sees who's genuinely
 * free, least-loaded first. Pure.
 */
export function suggestForProposedShift(base: EvalContext, shift: ProposedShift): ResolutionCandidate[] {
  const hypo: Shift = {
    id: TEMP_ID,
    date: shift.date,
    start: shift.start,
    end: shift.end,
    requiredHeadcount: shift.requiredHeadcount,
    requiredByRole: shift.requiredByRole ?? {},
    assigned: [],
    status: "draft",
  };
  const ctx: EvalContext = { ...base, state: { ...base.state, shifts: { ...base.state.shifts, [TEMP_ID]: hypo } } };
  return findResolutions(TEMP_ID, ctx);
}

/** A short, plain-language line for a per-employee violation (for the Build UI — no LLM needed for a fixed set). */
export function describeViolation(v: HardViolation): string {
  switch (v.kind) {
    case "double_booked": return "already on another shift that overlaps this time";
    case "time_off_conflict": return "has approved time off during this shift";
    case "over_hours": return `would exceed their weekly hours cap by ${v.overBy}h`;
    case "ineligible": return "doesn't have the required role for this shift";
    case "coverage": return "leaves a coverage gap";
    default: return "conflict";
  }
}
