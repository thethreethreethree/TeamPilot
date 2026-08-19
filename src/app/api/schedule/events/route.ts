import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { validateScheduleEvent } from "@/lib/schedule/eventSchema";
import { deriveState } from "@/lib/schedule/deriveState";
import type { ScheduleEvent } from "@/lib/schedule/types";

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

type EventRow = {
  id: string;
  company_id: string;
  type: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
  seq: number;
};

function toEvent(r: EventRow): ScheduleEvent {
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

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-events-append", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const body = await readBody(req, AppendSchema);
  if (body instanceof NextResponse) return body;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  // RQ6 (Phase 3/5, closure.md) — this route gates on auth + company but NOT on role-per-event-type.
  // Phase 1 is pure event-plumbing: any authenticated company member may append, and actor_id records
  // who. BEFORE the write paths are exposed through the manager/employee UIs, a role gate MUST be added
  // (Phase 3's verdict authority + Phase 5/6's role-scoped surfaces): an employee must not self-append
  // TIMEOFF_APPROVED or SHIFT_PUBLISHED/EMPLOYEE_ASSIGNED (manager-only). Do not ship a user-facing
  // write surface over this route without that gate.

  // Validate the payload against the event type's schema BEFORE any write (never append an
  // unvalidated object — build plan section 5). Invalid → 400 with the specific issues.
  const validated = validateScheduleEvent(body.type, body.payload ?? {});
  if (!validated.ok) {
    return NextResponse.json({ error: "Invalid schedule event.", issues: validated.issues }, { status: 400 });
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
          .select("id, company_id, type, actor_id, payload, occurred_at, seq")
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

  const events = rows.map(toEvent);
  const state = deriveState(events);
  return NextResponse.json({ events, state });
}
