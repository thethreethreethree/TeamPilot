/**
 * Schedule Management System — resolution search (Phase 4, DETERMINISTIC part; build plan section 5.1 step 5).
 *
 * When a change leaves a coverage gap, the system does NOT just deny it (§2 — find a better room, not a
 * locked door). This searches for employees who could fill the gap. It is DETERMINISTIC and, crucially,
 * REUSES the single authority (evaluateChange) to test each candidate rather than re-deriving eligibility
 * (A40 — consume the verdict, never recompute it). The LLM (the other half of Phase 4) turns these
 * candidates into a humane proposal; it never invents them.
 */
import type { EvalContext } from "./authority";
import { evaluateChange } from "./authority";
import { shiftDurationHours, weeklyHoursOf } from "./constraints";

export interface ResolutionCandidate {
  employeeId: string;
  name: string;
  /** Hours this shift would add to the employee (for the impact explanation + fair-load ranking). */
  addsHours: number;
  /** The employee's current weekly hours BEFORE this shift (lower → assigned first, to spread load). */
  currentHours: number;
}

/**
 * Candidates who could fill an understaffed shift WITHOUT creating any absolute conflict (ineligible,
 * double-booked, working during approved time-off, over hours). Ranked by current weekly hours ascending
 * — the least-loaded eligible employee first (fair distribution, the soft preference). Returns [] when the
 * shift doesn't exist or nobody is available (an honest empty, the caller surfaces "no one free").
 *
 * A candidate is validated through evaluateChange (the single authority) — so eligibility/limits are the
 * SAME condition the approval gate uses; a resolution can never propose someone the gate would then reject.
 */
export function findResolutions(shiftId: string, ctx: EvalContext): ResolutionCandidate[] {
  const shift = ctx.state.shifts[shiftId];
  if (!shift) return [];
  const out: ResolutionCandidate[] = [];
  for (const emp of Object.values(ctx.employees)) {
    if (emp.status !== "active") continue;
    if (shift.assigned.includes(emp.id)) continue; // already on this shift
    const verdict = evaluateChange({ kind: "assign", shiftId, employeeId: emp.id }, ctx);
    // approvable = no ABSOLUTE violation → they genuinely CAN work it. (A coverage "gap" from other shifts
    // is overridable, not disqualifying for THIS assignment; approvable already excludes only absolutes.)
    if (!verdict.approvable) continue;
    // Week-scoped to the shift being filled (the shared helper) — the fair-load ranking is about THIS week's
    // load, not all-time; the same fix as RQ8, now one shared source so it can't drift again.
    const currentHours = weeklyHoursOf(ctx.state, emp.id, shift.date, ctx.weekStartDay ?? 1);
    out.push({ employeeId: emp.id, name: emp.name, addsHours: shiftDurationHours(shift.start, shift.end), currentHours });
  }
  // Fair-load ranking: least-loaded first; tie-break by name for a stable, deterministic order.
  out.sort((a, b) => a.currentHours - b.currentHours || a.name.localeCompare(b.name));
  return out;
}
