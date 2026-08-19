import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId, getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { validateScheduleEvent } from "@/lib/schedule/eventSchema";
import { deriveState } from "@/lib/schedule/deriveState";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "@/lib/schedule/eventRow";

/**
 * Schedule Management System — Phase 1 event-append + read API (CLAUDE.md 3.1).
 *
 * POST → validate a (type, payload) against its schema, then APPEND one immutable event. Never
 *        mutates. The DB enforces append-only (0220 raise-trigger); this route enforces payload
 *        shape (eventSchema) before the write.
 * GET  → the company's full event log (paged past PostgREST's 1000-row cap — a truncated log would
 *        derive WRONG state) + the derived ScheduleState, proving the read→replay path is reachable.
 *
 * RLS scopes every read/write to the caller's company; the append RPC derives company_id + actor
 * from the session, so a caller cannot write an event for another company.
 */

const AppendSchema = z.object({
  type: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// RQ6 role-per-event-type gate. These event types are things only a MANAGER does (define/publish shifts,
// assign, decide time off, set coverage, approve a swap). The complement — a time-off REQUEST, setting
// availability, requesting a swap — is open to any company member (for when staff self-service ships). This
// closes the raw-API self-approve gap: a non-manager could otherwise POST TIMEOFF_APPROVED for their own
// request via this route even though no UI exposes it.
export const MANAGER_ONLY_EVENT_TYPES = new Set<string>([
  "SHIFT_DEFINED", "SHIFT_PUBLISHED", "SHIFT_UNPUBLISHED", "SHIFT_CANCELLED",
  "EMPLOYEE_ASSIGNED", "EMPLOYEE_UNASSIGNED",
  "TIMEOFF_APPROVED", "TIMEOFF_DENIED",
  "COVERAGE_REQ_DEFINED", "COVERAGE_REQ_CHANGED", "COVERAGE_REQ_REMOVED",
  "SWAP_APPROVED",
]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-events-append", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const body = await readBody(req, AppendSchema);
  if (body instanceof NextResponse) return body;

  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Validate the payload against the event type's schema BEFORE any write (never append an
  // unvalidated object — build plan section 5). Invalid → 400 with the specific issues.
  const validated = validateScheduleEvent(body.type, body.payload ?? {});
  if (!validated.ok) {
    return NextResponse.json({ error: "Invalid schedule event.", issues: validated.issues }, { status: 400 });
  }

  // RQ6 (audit fix): a manager-only event type requires ctx.isAdmin. Employee-appropriate types
  // (TIMEOFF_REQUESTED / AVAILABILITY_SET / SWAP_REQUESTED) are open to any company member — for when
  // staff self-service ships. Closes the raw-API self-approve gap the ground-up audit surfaced.
  if (MANAGER_ONLY_EVENT_TYPES.has(validated.event.type) && !ctx.isAdmin) {
    return NextResponse.json({ error: "Only a manager can perform this action." }, { status: 403 });
  }

  // Append via the security-invoker RPC (derives company_id + actor from the session, enforces RLS).
  const { data: id, error } = await sb.rpc("append_schedule_event", {
    p_type: validated.event.type,
    p_payload: validated.event.payload,
  });
  if (error) {
    // Fail loud (3.4): a write failure is a real 500, never a false success.
    console.error("[schedule/events] append failed:", error.message);
    return NextResponse.json({ error: "Couldn't record the schedule event." }, { status: 500 });
  }

  return NextResponse.json({ id }, { status: 201 });
}

export async function GET(_req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  // The FULL log, paged — replaying a truncated log derives wrong state (the 1000-row silent-cap class).
  let rows: EventRow[];
  try {
    rows = await fetchAllPaged<EventRow>(
      (from, to) =>
        sb
          .from("schedule_event")
          .select(EVENT_COLUMNS)
          .eq("company_id", companyId)
          .order("seq", { ascending: true })
          .range(from, to),
      { label: "schedule_event log" },
    );
  } catch (e) {
    // A read failure must not read as an empty schedule (error-dressed-as-no-data, INV22 / 3.4).
    console.error("[schedule/events] log read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load the schedule." }, { status: 500 });
  }

  const events = rows.map(rowToEvent);
  const state = deriveState(events);
  return NextResponse.json({ events, state });
}
