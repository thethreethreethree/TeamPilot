/**
 * Schedule Management System — assemble the EvalContext (Phase 5/6, for the time-off review flow).
 *
 * The authority (evaluateChange) + resolution search (findResolutions) are PURE — they take an EvalContext.
 * This builds that context from the raw data a route fetched: the event log (→ deriveState), the roster
 * (→ employees map), and a requirement-for-shift lookup derived from the coverage requirements in state.
 *
 * requirementForShift mapping (FIRST VERSION, flagged for refinement): a coverage requirement with a
 * timeWindow applies to shifts whose times overlap that window; a requirement with NO timeWindow applies to
 * EVERY shift (no window = no time restriction — for any appliesTo, so a "shift"/"role" floor set without a
 * window is honored rather than silently ignored). Among applicable requirements the STRICTEST (highest
 * minHeadcount) wins. A richer per-shift/role mapping (requirements against specific shifts) is a follow-up.
 */
import type { ScheduleEvent, ScheduleState, Employee, CoverageRequirement } from "./types";
import { deriveState } from "./deriveState";
import type { EvalContext } from "./authority";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  // "HH:mm" string compare works for same-day windows; an end<=start (overnight) is treated as spanning to 24:00.
  const ae = aEnd > aStart ? aEnd : "24:00";
  const be = bEnd > bStart ? bEnd : "24:00";
  return aStart < be && bStart < ae;
}

export function buildEvalContext(args: {
  events: ScheduleEvent[];
  employees: Employee[];
}): EvalContext {
  const state: ScheduleState = deriveState(args.events);
  const employees: Record<string, Employee> = {};
  for (const e of args.employees) employees[e.id] = e;

  const reqs: CoverageRequirement[] = Object.values(state.coverageReqs);

  const requirementForShift = (shiftId: string): { minHeadcount: number; minByRole: Record<string, number> } | null => {
    const shift = state.shifts[shiftId];
    if (!shift) return null;
    // COMBINE every applicable requirement — the strictest of each dimension (max headcount, max per role).
    // Picking only the highest-headcount requirement would drop a role floor set on a separate requirement
    // (e.g. "3 people" + "1 nurse" → the nurse requirement must still hold), so we merge them.
    let combined: { minHeadcount: number; minByRole: Record<string, number> } | null = null;
    for (const r of reqs) {
      // With a window: overlap. Without a window: applies to every shift (any appliesTo) — a floor with no
      // time restriction, so a "shift"/"role" requirement set without a window is honored, not ignored.
      const applies = r.timeWindow
        ? overlaps(shift.start, shift.end, r.timeWindow.start, r.timeWindow.end)
        : true;
      if (!applies) continue;
      if (!combined) combined = { minHeadcount: 0, minByRole: {} };
      combined.minHeadcount = Math.max(combined.minHeadcount, r.minHeadcount);
      for (const [role, n] of Object.entries(r.minByRole)) {
        combined.minByRole[role] = Math.max(combined.minByRole[role] ?? 0, n);
      }
    }
    // The shift's OWN requiredHeadcount is a coverage floor too — a shift that says it needs N people must
    // have N (the Build page collects this; imports set it). Without this it was a dead field: collected +
    // stored but never enforced. Combined as a max with any coverage requirements.
    const shiftFloor = typeof shift.requiredHeadcount === "number" ? shift.requiredHeadcount : 0;
    if (shiftFloor > 0) {
      if (!combined) combined = { minHeadcount: 0, minByRole: {} };
      combined.minHeadcount = Math.max(combined.minHeadcount, shiftFloor);
    }
    return combined;
  };

  return { state, employees, requirementForShift };
}
