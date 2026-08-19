import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { deriveState } from "@/lib/schedule/deriveState";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "@/lib/schedule/eventRow";
import { EMPLOYEE_COLUMNS, type EmployeeRow } from "@/lib/schedule/employeeRow";

/**
 * Schedule Management System — record a time-off request + the manager's decision (Phase 5/6 review flow).
 *
 * A manager records a time-off request for a staff member and, in the same action, the decision — approve
 * or deny (or leave it pending). Everything is append-only events (TIMEOFF_REQUESTED, then APPROVED/DENIED);
 * a correction is a new event. Manager-only (the manager operates the tool; standalone staff have no
 * account yet). The impact was shown by /timeoff/evaluate first — this only records the outcome.
 */
export const maxDuration = 30;

const Body = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(["vacation", "sick", "personal", "day_off"]),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  decision: z.enum(["request", "approve", "deny"]).default("request"),
});

/** The company's recorded time off (derived from the log), each with the staff member's name, most-recent
 *  start first — so a manager can see who is off / pending, not just evaluate a new request. */
export async function GET(_req: NextRequest) {
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sb = await createClient();
  try {
    const [evRows, empRows] = await Promise.all([
      fetchAllPaged<EventRow>(
        (from, to) => sb.from("schedule_event").select(EVENT_COLUMNS).eq("company_id", ctx.companyId).order("seq", { ascending: true }).range(from, to),
        { label: "schedule_event" },
      ),
      fetchAllPaged<EmployeeRow>(
        (from, to) => sb.from("schedule_employee").select(EMPLOYEE_COLUMNS).eq("company_id", ctx.companyId).order("id").range(from, to),
        { label: "schedule_employee" },
      ),
    ]);
    const nameOf = new Map(empRows.map((r) => [r.id, r.name]));
    const today = new Date().toISOString().slice(0, 10); // server date; tz-approximate until RQ4
    // Current/upcoming only — a fully-PAST time-off is over, so it's just noise that accumulates.
    const timeOff = Object.values(deriveState(evRows.map(rowToEvent)).timeOff)
      .filter((t) => t.end >= today)
      .map((t) => ({ ...t, employeeName: nameOf.get(t.employeeId) ?? "(unknown)" }))
      .sort((a, b) => a.start.localeCompare(b.start)); // soonest first
    return NextResponse.json({ timeOff });
  } catch (e) {
    console.error("[schedule/timeoff] list read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load time off." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-timeoff", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can record time off." }, { status: 403 });

  const sb = await createClient();
  const timeOffId = crypto.randomUUID();

  // 1. The request (always recorded first).
  const { error: reqErr } = await sb.rpc("append_schedule_event", {
    p_type: "TIMEOFF_REQUESTED",
    p_payload: { timeOffId, employeeId: body.employeeId, type: body.type, start: body.start, end: body.end },
  });
  if (reqErr) {
    console.error("[schedule/timeoff] request append failed:", reqErr.message);
    return NextResponse.json({ error: "Couldn't record the request." }, { status: 500 });
  }

  // 2. The decision, if made now.
  let status: "requested" | "approved" | "denied" = "requested";
  if (body.decision === "approve" || body.decision === "deny") {
    const decisionType = body.decision === "approve" ? "TIMEOFF_APPROVED" : "TIMEOFF_DENIED";
    const { error: decErr } = await sb.rpc("append_schedule_event", {
      p_type: decisionType,
      p_payload: { timeOffId },
    });
    if (decErr) {
      // The request stands; the decision can be re-applied. Honest: don't claim it was decided.
      console.error("[schedule/timeoff] decision append failed:", decErr.message);
      return NextResponse.json(
        { timeOffId, status: "requested", warning: "Recorded the request, but couldn't record the decision — try approving/denying again." },
        { status: 207 },
      );
    }
    status = body.decision === "approve" ? "approved" : "denied";
  }

  return NextResponse.json({ timeOffId, status }, { status: 201 });
}
