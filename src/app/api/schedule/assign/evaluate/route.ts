import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { buildEvalContext } from "@/lib/schedule/evalContext";
import { evaluateAssignments } from "@/lib/schedule/assignEval";
import { getScheduleSettings } from "@/lib/schedule/settings";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "@/lib/schedule/eventRow";
import { EMPLOYEE_COLUMNS, rowToEmployee, type EmployeeRow } from "@/lib/schedule/employeeRow";

/**
 * Schedule Management System — evaluate a PROPOSED shift's assignments before committing (the plan's "AI
 * evaluates changes and surfaces impact", wired for the primary Build flow). Given a proposed shift + the
 * staff a manager wants on it, returns each person's absolute conflicts (double-booking / approved time-off /
 * over-hours / ineligibility) so the manager sees them BEFORE creating an unworkable assignment. Read-only —
 * evaluates against the current derived state, writes nothing. Manager-only.
 */
export const maxDuration = 30;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: hhmm,
  end: hhmm,
  requiredHeadcount: z.number().int().nonnegative().default(0),
  requiredByRole: z.record(z.string().min(1).max(60), z.number().int().nonnegative()).optional(),
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-assign-evaluate", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can evaluate assignments." }, { status: 403 });

  const sb = await createClient();
  try {
    const [evRows, empRows, settings] = await Promise.all([
      fetchAllPaged<EventRow>(
        (from, to) => sb.from("schedule_event").select(EVENT_COLUMNS).eq("company_id", ctx.companyId).order("seq", { ascending: true }).range(from, to),
        { label: "schedule_event" },
      ),
      fetchAllPaged<EmployeeRow>(
        (from, to) => sb.from("schedule_employee").select(EMPLOYEE_COLUMNS).eq("company_id", ctx.companyId).order("id").range(from, to),
        { label: "schedule_employee" },
      ),
      getScheduleSettings(sb, ctx.companyId),
    ]);
    const evalCtx = buildEvalContext({ events: evRows.map(rowToEvent), employees: empRows.map(rowToEmployee), weekStartDay: settings.workweekStart });
    const impacts = evaluateAssignments(
      evalCtx,
      { date: body.date, start: body.start, end: body.end, requiredHeadcount: body.requiredHeadcount, requiredByRole: body.requiredByRole },
      body.employeeIds,
    );
    return NextResponse.json({ impacts });
  } catch (e) {
    console.error("[schedule/assign/evaluate] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't evaluate the assignments." }, { status: 500 });
  }
}
