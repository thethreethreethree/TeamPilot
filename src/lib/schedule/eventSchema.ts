/**
 * Schedule event payload validation (Phase 1). Every event is validated against its type's schema
 * at the append boundary BEFORE it is written (build plan: "validates + appends; never mutates";
 * and section 5's rule that even a human/LLM-originated request is a proposal validated against a
 * schema before it becomes an event). An invalid payload is rejected with a real error — never
 * written and never silently coerced.
 */
import { z } from "zod";
import { SCHEDULE_EVENT_TYPES, type ScheduleEventType } from "./types";

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");
const roleCounts = z.record(z.string().min(1), z.number().int().nonnegative());
const timeOffType = z.enum(["vacation", "sick", "personal", "day_off"]);

const PAYLOADS: Record<ScheduleEventType, z.ZodType> = {
  SHIFT_DEFINED: z.object({
    shiftId: id,
    date: isoDate,
    start: hhmm,
    end: hhmm,
    requiredHeadcount: z.number().int().nonnegative(),
    requiredByRole: roleCounts.optional(),
  }),
  SHIFT_PUBLISHED: z.object({ shiftId: id }),
  SHIFT_UNPUBLISHED: z.object({ shiftId: id }),
  EMPLOYEE_ASSIGNED: z.object({ shiftId: id, employeeId: id }),
  EMPLOYEE_UNASSIGNED: z.object({ shiftId: id, employeeId: id }),
  TIMEOFF_REQUESTED: z.object({
    timeOffId: id,
    employeeId: id,
    type: timeOffType,
    start: isoDate,
    end: isoDate,
    partial: z.boolean().optional(),
  }),
  TIMEOFF_APPROVED: z.object({ timeOffId: id }),
  TIMEOFF_DENIED: z.object({ timeOffId: id }),
  AVAILABILITY_SET: z.object({
    employeeId: id,
    weekly: z
      .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), from: hhmm, to: hhmm }))
      .optional(),
    unavailableDates: z.array(isoDate).optional(),
  }),
  COVERAGE_REQ_DEFINED: z.object({
    requirementId: id,
    appliesTo: z.enum(["day", "shift", "role"]),
    timeWindow: z.object({ start: hhmm, end: hhmm }).optional(),
    minHeadcount: z.number().int().nonnegative(),
    minByRole: roleCounts.optional(),
  }),
  COVERAGE_REQ_CHANGED: z.object({
    requirementId: id,
    appliesTo: z.enum(["day", "shift", "role"]).optional(),
    timeWindow: z.object({ start: hhmm, end: hhmm }).optional(),
    minHeadcount: z.number().int().nonnegative().optional(),
    minByRole: roleCounts.optional(),
  }),
  // Tombstone: remove a coverage requirement (the projector deletes it). Corrections stay append-only.
  COVERAGE_REQ_REMOVED: z.object({ requirementId: id }),
  SWAP_REQUESTED: z.object({ shiftId: id, fromEmployeeId: id, toEmployeeId: id }),
  SWAP_APPROVED: z.object({ shiftId: id, fromEmployeeId: id, toEmployeeId: id }),
};

export const scheduleEventTypeSchema = z.enum(
  SCHEDULE_EVENT_TYPES as [ScheduleEventType, ...ScheduleEventType[]],
);

export type ValidatedEvent = { type: ScheduleEventType; payload: Record<string, unknown> };

/**
 * Validate a (type, payload) against the type's schema. Returns the validated event or a list of
 * issues. Never throws — the caller turns issues into a 400.
 */
export function validateScheduleEvent(
  type: unknown,
  payload: unknown,
): { ok: true; event: ValidatedEvent } | { ok: false; issues: string[] } {
  const t = scheduleEventTypeSchema.safeParse(type);
  if (!t.success) {
    return { ok: false, issues: [`unknown event type: ${String(type)}`] };
  }
  const schema = PAYLOADS[t.data];
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  return { ok: true, event: { type: t.data, payload: parsed.data as Record<string, unknown> } };
}
