/**
 * Schedule Management System — the schedule_event row shape + column list + mapper, shared by every route
 * that reads the event log (events GET, coverage GET, timeoff/evaluate). One source so the DB column set +
 * the row→ScheduleEvent mapping can't drift between the routes that replay the log (the RQ17 drift class).
 */
import type { ScheduleEvent } from "./types";

export type EventRow = {
  id: string;
  company_id: string;
  type: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
  seq: number;
};

export const EVENT_COLUMNS = "id, company_id, type, actor_id, payload, occurred_at, seq";

export function rowToEvent(r: EventRow): ScheduleEvent {
  return {
    id: r.id,
    companyId: r.company_id,
    type: r.type as ScheduleEvent["type"],
    actorId: r.actor_id,
    payload: r.payload ?? {},
    occurredAt: r.occurred_at,
    seq: r.seq,
  };
}
