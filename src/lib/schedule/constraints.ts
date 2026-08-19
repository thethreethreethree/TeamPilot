/**
 * Schedule Management System — the constraint layer (Phase 2, build plan section 4).
 *
 * Pure, deterministic predicates the AI reasoning layer (Phase 4) and the single decision authority
 * (Phase 3) build on. HARD constraints (never violable) return pass/fail; SOFT constraints
 * (optimized toward, tradeable) return a score. The two are kept in DISTINCT functions with distinct
 * return shapes — blurring them is the design failure section 4 exists to prevent.
 *
 * These functions do NOT decide anything and do NOT compute the final verdict — that is Phase 3's
 * single authority (A40), which consumes these. They are the math the authority runs.
 */
import type { Shift, CoverageRequirement, Employee } from "./types";

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Duration of a shift in hours, from "HH:mm" start/end. An end at or before the start is treated as
 *  crossing midnight (+24h) — e.g. 22:00→06:00 is 8h. Returns 0 for malformed input. */
export function shiftDurationHours(start: string, end: string): number {
  const m = (t: string): number | null => {
    const x = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
    if (!x) return null;
    return Number(x[1]) * 60 + Number(x[2]);
  };
  const s = m(start);
  const e = m(end);
  if (s === null || e === null) return 0;
  const mins = e > s ? e - s : e + 24 * 60 - s;
  return mins / 60;
}

// ── HARD constraints (pass/fail) ──────────────────────────────────────────────

export type SlotRequirement = { role?: string | null; skills?: string[]; certifications?: string[] };

/**
 * Eligibility (hard): may this employee fill a slot? Requires active status, the required role (if the
 * slot names one), and ALL required skills + certifications. An inactive employee is never eligible.
 */
export function isEligible(emp: Employee, slot: SlotRequirement): boolean {
  if (emp.status !== "active") return false;
  if (slot.role != null && slot.role !== "" && emp.role !== slot.role) return false;
  for (const s of slot.skills ?? []) if (!emp.skills.includes(s)) return false;
  for (const c of slot.certifications ?? []) if (!emp.certifications.includes(c)) return false;
  return true;
}

export type CoverageGap =
  | { kind: "headcount"; need: number }
  | { kind: "role"; role: string; need: number };

export type CoverageResult = { meets: boolean; gaps: CoverageGap[] };

/**
 * Coverage (hard): does a shift's current assignment meet a coverage requirement? Checks total
 * headcount vs min_headcount AND each role's count vs min_by_role. `roleOf` maps an assigned employee
 * id to their role (the caller supplies it from the roster). Returns every gap, not just the first —
 * the resolution search (Phase 4) needs them all.
 */
export function meetsCoverage(
  shift: Pick<Shift, "assigned">,
  requirement: Pick<CoverageRequirement, "minHeadcount" | "minByRole">,
  roleOf: (employeeId: string) => string | null,
): CoverageResult {
  const gaps: CoverageGap[] = [];
  const headcount = shift.assigned.length;
  if (headcount < requirement.minHeadcount) {
    gaps.push({ kind: "headcount", need: requirement.minHeadcount - headcount });
  }
  for (const [role, min] of Object.entries(requirement.minByRole)) {
    const have = shift.assigned.filter((id) => roleOf(id) === role).length;
    if (have < min) gaps.push({ kind: "role", role, need: min - have });
  }
  return { meets: gaps.length === 0, gaps };
}

export type LimitResult = { within: boolean; overBy: number };

/**
 * Labor limit (hard): is the employee within their weekly hours cap given the PROPOSED total (their
 * hours after the change being evaluated)? No cap (null max) always passes. `overBy` is the hours over
 * the cap (0 when within), for the impact explanation.
 */
export function withinLimits(emp: Pick<Employee, "maxHoursWeek">, proposedWeeklyHours: number): LimitResult {
  if (emp.maxHoursWeek == null) return { within: true, overBy: 0 };
  const over = proposedWeeklyHours - emp.maxHoursWeek;
  return { within: over <= 0, overBy: over > 0 ? over : 0 };
}

// ── SOFT constraints (score in [0,1], higher = better) ────────────────────────

/**
 * Fair-distribution score (soft): how evenly are hours spread across the roster? 1.0 = perfectly even,
 * lower = more lopsided. Uses the coefficient of variation of assigned hours, clamped. This is a
 * TRADEABLE preference, never a gate — it returns a score, not pass/fail, exactly so the authority
 * can weigh it without it ever blocking a change (the hard/soft separation, section 4).
 */
export function fairnessScore(hoursByEmployee: number[]): number {
  const xs = hoursByEmployee.filter((h) => Number.isFinite(h));
  if (xs.length <= 1) return 1;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 1;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation
  return Math.max(0, 1 - cv); // cv 0 → 1.0 (even); larger spread → lower score
}
