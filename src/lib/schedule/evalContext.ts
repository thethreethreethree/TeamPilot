/**
 * Schedule Management System — assemble the EvalContext (Phase 5/6, for the time-off review flow).
 *
 * The authority (evaluateChange) + resolution search (findResolutions) are PURE — they take an EvalContext.
 * This builds that context from the raw data a route fetched: the event log (→ deriveState), the roster
 * (→ employees map), and a requirement-for-shift lookup derived from the coverage requirements in state.
 *
 * requirementForShift mapping (FIRST VERSION, flagged for refinement): a coverage requirement applies to a
 * shift when appliesTo === "day" (applies to every shift), or its timeWindow overlaps the shift's start-end.
 * Among applicable requirements the STRICTEST (highest minHeadcount) wins. A richer per-shift/role mapping
 * (once the coverage editor defines requirements against specific shifts) is a follow-up.
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
    let best: { minHeadcount: number; minByRole: Record<string, number> } | null = null;
    for (const r of reqs) {
      const applies =
        r.appliesTo === "day" ||
        (r.timeWindow ? overlaps(shift.start, shift.end, r.timeWindow.start, r.timeWindow.end) : false);
      if (!applies) continue;
      if (!best || r.minHeadcount > best.minHeadcount) best = { minHeadcount: r.minHeadcount, minByRole: r.minByRole };
    }
    return best;
  };

  return { state, employees, requirementForShift };
}
