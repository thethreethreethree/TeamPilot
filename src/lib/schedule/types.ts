/**
 * Schedule Management System — event + derived-state types (Phase 1).
 *
 * The event log (`schedule_event`, migration 0220) is the source of truth; every shape below under
 * ScheduleState is DERIVED by replaying events (deriveState.ts), never edited in place (CLAUDE.md 3.1).
 * These types are the contract the later phases build on: Phase 2 reads ScheduleState to evaluate
 * constraints, Phase 3 returns a verdict over it, Phases 5–6 render it.
 */

/** The domain event vocabulary (build plan section 3.1). Stored as `type` text in the DB; validated
 *  against this union at the append boundary. New types are added per phase — additive only. */
export type ScheduleEventType =
  | "SHIFT_DEFINED"
  | "SHIFT_PUBLISHED"
  | "SHIFT_UNPUBLISHED"
  | "EMPLOYEE_ASSIGNED"
  | "EMPLOYEE_UNASSIGNED"
  | "TIMEOFF_REQUESTED"
  | "TIMEOFF_APPROVED"
  | "TIMEOFF_DENIED"
  | "AVAILABILITY_SET"
  | "COVERAGE_REQ_DEFINED"
  | "COVERAGE_REQ_CHANGED"
  | "COVERAGE_REQ_REMOVED"
  | "SWAP_REQUESTED"
  | "SWAP_APPROVED";

export const SCHEDULE_EVENT_TYPES: readonly ScheduleEventType[] = [
  "SHIFT_DEFINED",
  "SHIFT_PUBLISHED",
  "SHIFT_UNPUBLISHED",
  "EMPLOYEE_ASSIGNED",
  "EMPLOYEE_UNASSIGNED",
  "TIMEOFF_REQUESTED",
  "TIMEOFF_APPROVED",
  "TIMEOFF_DENIED",
  "AVAILABILITY_SET",
  "COVERAGE_REQ_DEFINED",
  "COVERAGE_REQ_CHANGED",
  "COVERAGE_REQ_REMOVED",
  "SWAP_REQUESTED",
  "SWAP_APPROVED",
] as const;

/** One immutable event as read back from the log. `seq` is the causal replay order. */
export interface ScheduleEvent {
  id: string;
  companyId: string;
  type: ScheduleEventType;
  actorId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
  seq: number;
}

// ── Derived state (projections — never persisted in Phase 1; the projector is the source) ──

/** Phase 1 tracks the lifecycle status the events themselves carry. `understaffed` is a DERIVED
 *  flag computed against coverage requirements — that comparison is Phase 2 (meetsCoverage), so it
 *  is intentionally NOT set here (setting it would require the constraint layer that doesn't exist
 *  yet). Phase 1 status is the published/draft lifecycle only. */
export type ShiftStatus = "draft" | "published";

export interface Shift {
  id: string;
  date: string; // ISO date, YYYY-MM-DD
  start: string; // "HH:mm" (local to the org tz — tz math is a Phase-2 precondition, see A41 flag)
  end: string;
  requiredHeadcount: number;
  requiredByRole: Record<string, number>;
  assigned: string[]; // employee ids, in assignment order, de-duplicated
  status: ShiftStatus;
}

export type TimeOffStatus = "requested" | "approved" | "denied";

export interface TimeOff {
  id: string;
  employeeId: string;
  type: string; // vacation | sick | personal | day_off (validated at the boundary)
  start: string;
  end: string;
  partial: boolean;
  status: TimeOffStatus;
}

export interface Availability {
  employeeId: string;
  weekly: { dayOfWeek: number; from: string; to: string }[];
  unavailableDates: string[];
}

export interface CoverageRequirement {
  id: string;
  appliesTo: "day" | "shift" | "role";
  timeWindow: { start: string; end: string } | null;
  minHeadcount: number;
  minByRole: Record<string, number>;
}

/** The full derived schedule state — a pure projection of the event log. Keyed maps so replay is
 *  order-stable and lookups are O(1) for the constraint layer. */
export interface ScheduleState {
  shifts: Record<string, Shift>;
  timeOff: Record<string, TimeOff>;
  availability: Record<string, Availability>; // keyed by employeeId
  coverageReqs: Record<string, CoverageRequirement>;
}

/** A staff member (Phase 2 — the standalone roster, `schedule_employee`). NOT event-sourced; NOT tied
 *  to an Elostate account (a future optional link). The constraint layer reads these alongside the
 *  derived ScheduleState. */
export interface Employee {
  id: string;
  companyId: string;
  name: string;
  role: string | null;
  employmentType: string | null;
  skills: string[];
  certifications: string[];
  maxHoursWeek: number | null; // labor limit; null = no cap
  minHoursWeek: number | null;
  status: "active" | "inactive";
}
