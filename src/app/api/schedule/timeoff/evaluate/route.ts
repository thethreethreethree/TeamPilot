import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { buildEvalContext } from "@/lib/schedule/evalContext";
import { evaluateChange } from "@/lib/schedule/authority";
import { findResolutions } from "@/lib/schedule/resolution";
import { getScheduleSettings } from "@/lib/schedule/settings";
import { generateProposal } from "@/lib/schedule/ai";
import { EVENT_COLUMNS, rowToEvent, type EventRow } from "@/lib/schedule/eventRow";
import { EMPLOYEE_COLUMNS, rowToEmployee, type EmployeeRow } from "@/lib/schedule/employeeRow";
import type { ScheduleEvent, Employee } from "@/lib/schedule/types";

/**
 * Schedule Management System — evaluate a time-off request (Phase 5/6 review flow). Given a proposed
 * time-off, return the DETERMINISTIC verdict (coverage impact) + resolution candidates + an advisory
 * LLM proposal — WITHOUT persisting. This is what the manager sees before approving/denying (§3.3
 * guide-don't-overtake). Manager-only.
 *
 * The verdict is the load-bearing, deterministic part (A40); the LLM proposal is a nice-to-have that
 * fails SOFT — if it errors, the verdict + candidates still return.
 */
export const maxDuration = 60;

const Body = z.object({
  employeeId: z.string().uuid(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-timeoff-evaluate", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can evaluate a request." }, { status: 403 });

  const sb = await createClient();
  let events: ScheduleEvent[];
  let employees: Employee[];
  let weekStartDay = 1;
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
    events = evRows.map(rowToEvent);
    employees = empRows.map(rowToEmployee);
    weekStartDay = settings.workweekStart;
  } catch (e) {
    console.error("[schedule/timeoff/evaluate] load failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load the schedule to evaluate the request." }, { status: 500 });
  }

  const evalCtx = buildEvalContext({ events, employees, weekStartDay });
  const verdict = evaluateChange({ kind: "time_off", employeeId: body.employeeId, start: body.start, end: body.end }, evalCtx);

  // For each shift that would drop coverage, find who could fill it (deterministic, reuses the authority).
  const gapShiftIds = verdict.violations.filter((v) => v.kind === "coverage").map((v) => v.shiftId);
  const resolutionsByShift = gapShiftIds.map((shiftId) => ({ shiftId, candidates: findResolutions(shiftId, evalCtx) }));

  // Advisory proposal (fail-soft — the verdict already stands).
  let proposal: string | null = null;
  if (!verdict.autoApprovable && resolutionsByShift.length > 0) {
    try {
      const topCandidates = resolutionsByShift.flatMap((r) => r.candidates).slice(0, 5);
      proposal = await generateProposal({
        impactSummary: `Approving this would leave ${gapShiftIds.length} shift(s) short.`,
        candidates: topCandidates,
      });
    } catch (e) {
      console.error("[schedule/timeoff/evaluate] proposal failed (non-fatal):", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ verdict, resolutionsByShift, proposal });
}
