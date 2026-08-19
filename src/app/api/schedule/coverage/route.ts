import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { buildEvalContext } from "@/lib/schedule/evalContext";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "@/lib/schedule/eventRow";
import { EMPLOYEE_COLUMNS, rowToEmployee, type EmployeeRow } from "@/lib/schedule/employeeRow";
import { findCoverageGaps } from "@/lib/schedule/coverageStatus";

/**
 * Schedule Management System — coverage requirements (Phase 5). A coverage requirement is the "no lapse"
 * rule the authority checks (min headcount for a day / time-window / role). It is EVENT-SOURCED
 * (COVERAGE_REQ_DEFINED), so POST appends the event and GET returns the derived requirements (replayed).
 * Manager-only.
 */
export const maxDuration = 30;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Body = z.object({
  appliesTo: z.enum(["day", "shift", "role"]),
  minHeadcount: z.number().int().nonnegative(),
  timeWindow: z.object({ start: hhmm, end: hhmm }).optional(),
  minByRole: z.record(z.string().min(1).max(60), z.number().int().nonnegative()).optional(),
});

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
    // Derive state ONCE (buildEvalContext replays the log) and reuse it for BOTH the requirements list and
    // the proactive gaps — no double replay.
    const evalCtx = buildEvalContext({ events: evRows.map(rowToEvent), employees: empRows.map(rowToEmployee) });
    return NextResponse.json({
      requirements: Object.values(evalCtx.state.coverageReqs),
      gaps: findCoverageGaps(evalCtx),
    });
  } catch (e) {
    console.error("[schedule/coverage] read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load coverage requirements." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-coverage", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can set coverage." }, { status: 403 });

  const requirementId = crypto.randomUUID();
  const sb = await createClient();
  const { error } = await sb.rpc("append_schedule_event", {
    p_type: "COVERAGE_REQ_DEFINED",
    p_payload: {
      requirementId,
      appliesTo: body.appliesTo,
      minHeadcount: body.minHeadcount,
      ...(body.timeWindow ? { timeWindow: body.timeWindow } : {}),
      ...(body.minByRole ? { minByRole: body.minByRole } : {}),
    },
  });
  if (error) {
    console.error("[schedule/coverage] append failed:", error.message);
    return NextResponse.json({ error: "Couldn't save the coverage requirement." }, { status: 500 });
  }
  return NextResponse.json({ requirementId }, { status: 201 });
}

/**
 * Remove a coverage requirement (a manager fixing a mistaken rule). Appends a COVERAGE_REQ_REMOVED tombstone
 * — the projector deletes it; the log stays append-only. Manager-only. The append is company-scoped by the
 * RPC (auth_company_id()), so a removal only affects the caller's own company's derived state.
 */
export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-coverage-remove", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const requirementId = new URL(req.url).searchParams.get("requirementId") ?? "";
  if (!z.string().uuid().safeParse(requirementId).success) {
    return NextResponse.json({ error: "Invalid requirement id." }, { status: 400 });
  }

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can remove coverage." }, { status: 403 });

  const sb = await createClient();
  const { error } = await sb.rpc("append_schedule_event", {
    p_type: "COVERAGE_REQ_REMOVED",
    p_payload: { requirementId },
  });
  if (error) {
    console.error("[schedule/coverage] remove append failed:", error.message);
    return NextResponse.json({ error: "Couldn't remove the coverage requirement." }, { status: 500 });
  }
  return NextResponse.json({ requirementId }, { status: 200 });
}
