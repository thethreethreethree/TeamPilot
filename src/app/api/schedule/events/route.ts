import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { validateScheduleEvent } from "@/lib/schedule/eventSchema";
import { deriveState } from "@/lib/schedule/deriveState";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "@/lib/schedule/eventRow";
import { EMPLOYEE_COLUMNS, rowToEmployee, type EmployeeRow } from "@/lib/schedule/employeeRow";
import { buildEvalContext } from "@/lib/schedule/evalContext";
import { evaluateChange, type Change } from "@/lib/schedule/authority";
import { getScheduleSettings } from "@/lib/schedule/settings";

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

// The events route now replays the log + roster to enforce the authority on assignment writes — a DB-heavy
// (LLM-free) step; give it the same budget as the advisory evaluate route so a large log can't time out.
export const maxDuration = 30;

/**
 * Finding C + D (schedule audit 2026-08-27). The authority (authority.ts) marks double-booking, assigning during
 * approved time-off, over-hours, and ineligibility as ABSOLUTE (`overridable:false`), but the raw write path never
 * consulted it — a manager could POST an impossible assignment (the A40 verdict-computed-but-not-consumed class,
 * one level up). This consumes the verdict AT THE WRITE BOUNDARY for the two assignment events: it REJECTS an
 * absolute violation (422) while still ALLOWING the manager's overridable cases (coverage gaps, `unavailable`) —
 * their warned-not-forbidden override is untouched. It also existence-checks the referenced ids first, because
 * evaluateChange treats a phantom shift/employee as approvable (authority.ts:144) — so a stale/foreign id would
 * otherwise append and inflate coverage with a body that isn't on the roster (Finding D).
 * Returns a rejection response to send, or null to proceed with the append.
 */
async function enforceAssignmentAuthority(
  sb: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  event: { type: string; payload: Record<string, unknown> },
): Promise<NextResponse | null> {
  const p = event.payload as { shiftId?: string; employeeId?: string; fromEmployeeId?: string; toEmployeeId?: string };
  const isSwap = event.type === "SWAP_APPROVED";
  const shiftId = p.shiftId ?? "";
  const assigneeId = (isSwap ? p.toEmployeeId : p.employeeId) ?? ""; // the person being put ONTO the shift
  const change: Change = isSwap
    ? { kind: "swap", shiftId, fromEmployeeId: p.fromEmployeeId ?? "", toEmployeeId: p.toEmployeeId ?? "" }
    : { kind: "assign", shiftId, employeeId: assigneeId };

  const [evRows, empRows, settings] = await Promise.all([
    fetchAllPaged<EventRow>((from, to) => sb.from("schedule_event").select(EVENT_COLUMNS).eq("company_id", companyId).order("seq", { ascending: true }).range(from, to), { label: "schedule_event" }),
    fetchAllPaged<EmployeeRow>((from, to) => sb.from("schedule_employee").select(EMPLOYEE_COLUMNS).eq("company_id", companyId).order("id").range(from, to), { label: "schedule_employee" }),
    getScheduleSettings(sb, companyId),
  ]);
  const ctx = buildEvalContext({ events: evRows.map(rowToEvent), employees: empRows.map(rowToEmployee), weekStartDay: settings.workweekStart });

  // Finding D — the referenced shift + assignee must exist in THIS company's derived state / roster. A phantom id
  // slips past evaluateChange (which returns approvable for a missing shift/employee) and would inflate coverage.
  if (!ctx.state.shifts[shiftId]) {
    return NextResponse.json({ error: "That shift no longer exists — refresh and try again." }, { status: 409 });
  }
  if (!ctx.employees[assigneeId]) {
    return NextResponse.json({ error: "That employee isn't on the roster." }, { status: 409 });
  }

  const verdict = evaluateChange(change, ctx);
  if (!verdict.approvable) {
    // An ABSOLUTE conflict (double-booked / approved-time-off / over-hours / ineligible). Overridable concerns
    // (coverage, unavailable) do NOT reach here — approvable is true when only overridable violations remain.
    return NextResponse.json({ error: verdict.reason, violations: verdict.violations }, { status: 422 });
  }
  return null;
}

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
  //
  // ⚠ PRECONDITION for staff self-service (schedule audit 2026-08-27, Finding A3F2): the open types above do NOT
  // yet bind `payload.employeeId` to the CALLER. That is correct TODAY — the model is manager-entered, so a manager
  // legitimately sets any employee's availability / files time-off for them, and no member UI exists. The MOMENT
  // staff get their own accounts, THIS is where you must add `payload.employeeId === ctx.employeeId` (or the caller's
  // own staff identity) for TIMEOFF_REQUESTED / AVAILABILITY_SET / SWAP_REQUESTED — otherwise member Alice could
  // rewrite colleague Bob's availability or file leave in his name (within-tenant, so RLS won't stop it). Do not
  // ship self-service without this binding.
  if (MANAGER_ONLY_EVENT_TYPES.has(validated.event.type) && !ctx.isAdmin) {
    return NextResponse.json({ error: "Only a manager can perform this action." }, { status: 403 });
  }

  // Finding C + D: enforce the authority's verdict on the assignment-creating events BEFORE the append, so an
  // absolute conflict (double-booking / approved-time-off / over-hours / ineligible) can't be written directly,
  // and a phantom shift/employee id is rejected. Overridable concerns (coverage/unavailable) still pass through.
  if (validated.event.type === "EMPLOYEE_ASSIGNED" || validated.event.type === "SWAP_APPROVED") {
    try {
      const blocked = await enforceAssignmentAuthority(sb, ctx.companyId, validated.event);
      if (blocked) return blocked;
    } catch (e) {
      // A read failure here must fail LOUD (§3.4) — never silently skip the guard and write an unchecked event.
      console.error("[schedule/events] authority enforcement read failed:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Couldn't verify the assignment right now — try again." }, { status: 503 });
    }
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
  // Finding F4 (§3.4 honesty): the full event log is manager-only (RLS SELECT is manager-scoped, 0230). Gate on
  // isAdmin so a non-manager gets an explicit 403, not an empty {events:[], state} that reads as "the schedule is
  // empty" — a permission denial dressed as no-data. (A rep's own view is the /personal route.)
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can view the full schedule." }, { status: 403 });
  const companyId = ctx.companyId;

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
