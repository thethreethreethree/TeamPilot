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
import { generateProposal } from "@/lib/schedule/ai";
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

type EventRow = { id: string; company_id: string; type: string; actor_id: string | null; payload: Record<string, unknown> | null; occurred_at: string; seq: number };
type EmpRow = { id: string; company_id: string; name: string; role: string | null; employment_type: string | null; skills: string[] | null; certifications: string[] | null; max_hours_week: number | null; min_hours_week: number | null; status: string };

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
  try {
    const [evRows, empRows] = await Promise.all([
      fetchAllPaged<EventRow>(
        (from, to) => sb.from("schedule_event").select("id, company_id, type, actor_id, payload, occurred_at, seq").eq("company_id", ctx.companyId).order("seq", { ascending: true }).range(from, to),
        { label: "schedule_event" },
      ),
      fetchAllPaged<EmpRow>(
        (from, to) => sb.from("schedule_employee").select("id, company_id, name, role, employment_type, skills, certifications, max_hours_week, min_hours_week, status").eq("company_id", ctx.companyId).order("id").range(from, to),
        { label: "schedule_employee" },
      ),
    ]);
    events = evRows.map((r) => ({ id: r.id, companyId: r.company_id, type: r.type as ScheduleEvent["type"], actorId: r.actor_id, payload: r.payload ?? {}, occurredAt: r.occurred_at, seq: r.seq }));
    employees = empRows.map((r) => ({ id: r.id, companyId: r.company_id, name: r.name, role: r.role, employmentType: r.employment_type, skills: r.skills ?? [], certifications: r.certifications ?? [], maxHoursWeek: r.max_hours_week, minHoursWeek: r.min_hours_week, status: r.status === "inactive" ? "inactive" : "active" }));
  } catch (e) {
    console.error("[schedule/timeoff/evaluate] load failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load the schedule to evaluate the request." }, { status: 500 });
  }

  const evalCtx = buildEvalContext({ events, employees });
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
