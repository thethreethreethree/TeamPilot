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
import type { Shift, CoverageRequirement, Employee, ScheduleState, Availability } from "./types";

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

/**
 * The week-start date of the week containing a YYYY-MM-DD date, returned as YYYY-MM-DD, or null for malformed
 * input. UTC-based so it is deterministic regardless of the runtime timezone (never parses a bare date string
 * through local time — the UTC-day class). Used to scope the weekly-hours cap + the grid week to ONE week.
 *
 * `weekStartDay` is the day the workweek begins, JS convention 0=Sunday..6=Saturday (RQ7 — a company setting
 * since 0224). It DEFAULTS to 1 (Monday, ISO 8601) so every caller that doesn't pass a company setting keeps
 * the prior behavior unchanged.
 */
export function weekStartOf(date: string, weekStartDay = 1): string | null {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!x) return null;
  const dt = new Date(Date.UTC(Number(x[1]), Number(x[2]) - 1, Number(x[3])));
  if (Number.isNaN(dt.getTime())) return null;
  const back = (dt.getUTCDay() - weekStartDay + 7) % 7; // days since the configured week-start day
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

/** Add `n` days to a YYYY-MM-DD date, UTC-based (deterministic regardless of runtime tz). Null if malformed. */
export function addDaysIso(iso: string, n: number): string | null {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!x) return null;
  const dt = new Date(Date.UTC(Number(x[1]), Number(x[2]) - 1, Number(x[3])));
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * Sum an employee's assigned hours WITHIN THE WEEK containing `weekOfDate` (ISO-Monday week). The cap is
 * `maxHoursWeek`, a WEEKLY limit, and `state.shifts` holds the ENTIRE append-only history — summing all of
 * it would inflate "weekly" hours to all-time. SHARED by the authority (the hours-cap check) and the
 * resolution search (fair-load ranking) so the two can't drift (they had separate copies; one was fixed for
 * RQ8 and the other silently kept summing all-time). A shift is attributed to the week of its start date.
 */
export function weeklyHoursOf(state: ScheduleState, employeeId: string, weekOfDate: string, weekStartDay = 1): number {
  const targetWeek = weekStartOf(weekOfDate, weekStartDay);
  let h = 0;
  for (const s of Object.values(state.shifts)) {
    if (!s.assigned.includes(employeeId)) continue;
    if (targetWeek !== null && weekStartOf(s.date, weekStartDay) !== targetWeek) continue; // only the target shift's week
    h += shiftDurationHours(s.start, s.end);
  }
  return h;
}

/** JS day-of-week (0=Sunday..6=Saturday) of a YYYY-MM-DD date, or null if malformed. UTC-based so it is
 *  deterministic regardless of the runtime timezone (the UTC-day class) — matches weekStartOf/addDaysIso. */
export function dayOfWeekOf(date: string): number | null {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!x) return null;
  const dt = new Date(Date.UTC(Number(x[1]), Number(x[2]) - 1, Number(x[3])));
  return Number.isNaN(dt.getTime()) ? null : dt.getUTCDay();
}

/**
 * Is an employee AVAILABLE to work a shift, per their set availability (RQ / Phase 6)? Availability is
 * OPT-IN: an employee with NO availability record is treated as available — otherwise every existing
 * employee (who has none set) would instantly become unschedulable. When a record exists:
 *   - the shift's start date in `unavailableDates` → unavailable (a specific day-off they marked).
 *   - `weekly` windows, IF ANY are set, are the ONLY times they can work: the shift's weekday must have a
 *     window that fully contains the shift's [start,end]. An empty `weekly` imposes no weekly restriction.
 * Overnight shifts (crossesMidnight) are checked against `unavailableDates` on BOTH the start day AND the next
 * calendar day they run into (span-aware, matching shiftHitsApprovedTimeOff) — but never against weekly windows
 * (a same-day window can't represent a span into the next day, and hard-blocking every overnight shift on
 * weekly windows would be wrong; the manager can still override this overridable violation). Times compare
 * lexicographically (zero-padded 24h "HH:mm"), which is correct ordering.
 */
export function isAvailable(availability: Availability | undefined, shift: { date: string; start: string; end: string }): boolean {
  if (!availability) return true; // opt-in: no record set = no constraint
  if (availability.unavailableDates.includes(shift.date)) return false;
  if (crossesMidnight(shift.start, shift.end)) {
    // Overnight shift ALSO occupies the next calendar day — check that day's off-mark too (span-aware,
    // matching shiftHitsApprovedTimeOff). Beyond the two date checks an overnight shift isn't weekly-blocked
    // (a same-day window can't represent a span into the next day).
    const next = addDaysIso(shift.date, 1);
    return !(next !== null && availability.unavailableDates.includes(next));
  }
  if (availability.weekly.length === 0) return true; // only specific dates constrain them
  const dow = dayOfWeekOf(shift.date);
  if (dow === null) return true; // malformed date — don't fabricate a block (defensive; validated upstream)
  const windows = availability.weekly.filter((w) => w.dayOfWeek === dow);
  if (windows.length === 0) return false; // they set weekly windows but none for this weekday → not available
  return windows.some((w) => w.from <= shift.start && w.to >= shift.end);
}

/** Does a "HH:mm"→"HH:mm" shift cross midnight (end at or before start)? Such a shift occupies its start
 *  date AND the next calendar day — so span-aware checks (time-off, coverage) must consider both. */
export function crossesMidnight(start: string, end: string): boolean {
  const m = (t: string): number | null => {
    const x = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
    return x ? Number(x[1]) * 60 + Number(x[2]) : null;
  };
  const s = m(start);
  const e = m(end);
  if (s === null || e === null) return false;
  return e <= s;
}

/**
 * Do two "HH:mm" ranges on the SAME day overlap in time? Overnight ranges (end ≤ start) extend +24h.
 * Half-open, so TOUCHING ranges do NOT overlap: a split shift 10:00–14:00 + 19:00–23:00 is not a clash,
 * but 10:00–14:00 + 13:00–17:00 is. This is what "a person can't be in two places" actually means — a
 * same-DATE check over-blocks legitimate split shifts (which the VA schedules use). Malformed input → false
 * (times are validated at the event boundary, so this is defensive only).
 */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const m = (t: string): number | null => {
    const x = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
    return x ? Number(x[1]) * 60 + Number(x[2]) : null;
  };
  const as = m(aStart);
  const bs = m(bStart);
  let ae = m(aEnd);
  let be = m(bEnd);
  if (as === null || ae === null || bs === null || be === null) return false;
  if (ae <= as) ae += 24 * 60;
  if (be <= bs) be += 24 * 60;
  return as < be && bs < ae;
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
