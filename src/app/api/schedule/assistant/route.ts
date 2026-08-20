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
import { getScheduleSettings, todayInTz } from "@/lib/schedule/settings";
import { evaluateChange, type EvalContext } from "@/lib/schedule/authority";
import { describeViolation } from "@/lib/schedule/assignEval";
import { interpretCommand, type AssistantAction } from "@/lib/schedule/assistant";
import type { Employee, Shift } from "@/lib/schedule/types";

/**
 * Schedule Management System — the conversational AI assistant (headline feature). Manager types an
 * instruction; the LLM interprets it into proposed actions (assistant.ts), and THIS route evaluates each
 * against the DETERMINISTIC authority (evaluateChange) and returns the reply + proposals + impact. Nothing is
 * written here (§3.3): the manager confirms a proposal, and the client appends the events via /schedule/events.
 * Manager-only. The LLM reads a context summary (roster, shifts, coverage) but never the DB itself.
 */
export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(12).optional(),
});

type EventToAppend = { type: string; payload: Record<string, unknown> };
interface Proposal {
  op: string;
  summary: string;
  events: EventToAppend[]; // appended in order by the client on Apply
  impact: string[]; // per-employee warnings (empty = clean)
  blocked: boolean; // true when the proposal can't be built (unknown staff / no matching shift)
  reason?: string; // why blocked
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-assistant", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can use the assistant." }, { status: 403 });

  const sb = await createClient();
  let evalCtx: EvalContext;
  let employees: Employee[];
  let today: string;
  try {
    const [evRows, empRows, settings] = await Promise.all([
      fetchAllPaged<EventRow>((f, t) => sb.from("schedule_event").select(EVENT_COLUMNS).eq("company_id", ctx.companyId).order("seq", { ascending: true }).range(f, t), { label: "assistant events" }),
      fetchAllPaged<EmployeeRow>((f, t) => sb.from("schedule_employee").select(EMPLOYEE_COLUMNS).eq("company_id", ctx.companyId).order("name").range(f, t), { label: "assistant roster" }),
      getScheduleSettings(sb, ctx.companyId),
    ]);
    employees = empRows.map(rowToEmployee);
    evalCtx = buildEvalContext({ events: evRows.map(rowToEvent), employees, weekStartDay: settings.workweekStart });
    today = todayInTz(settings.timezone);
  } catch (e) {
    console.error("[schedule/assistant] context read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't read the schedule." }, { status: 500 });
  }

  const state = evalCtx.state;
  const byName = new Map<string, Employee>();
  for (const e of employees) byName.set(norm(e.name), e);
  const resolveEmp = (name: string): Employee | null => {
    const n = norm(name);
    return byName.get(n) ?? employees.find((e) => norm(e.name).includes(n) || n.includes(norm(e.name))) ?? null;
  };

  // The LLM context: today + roster + a compact shift list (upcoming) + coverage. Data, never instructions.
  const context = JSON.stringify({
    today,
    roster: employees.filter((e) => e.status === "active").map((e) => ({ name: e.name, role: e.role ?? "any" })),
    shifts: Object.values(state.shifts)
      .filter((s) => s.date >= today)
      .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)))
      .slice(0, 120)
      .map((s) => ({ date: s.date, start: s.start, end: s.end, staff: s.assigned.map((id) => employees.find((e) => e.id === id)?.name ?? id) })),
    coverage: Object.values(state.coverageReqs).map((c) => ({ appliesTo: c.appliesTo, minHeadcount: c.minHeadcount, minByRole: c.minByRole })),
  });

  let reply: string;
  let actions: AssistantAction[];
  try {
    ({ reply, actions } = await interpretCommand(body.message, context, { history: body.history }));
  } catch (e) {
    console.error("[schedule/assistant] interpret failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The assistant is unavailable right now. Try again in a moment." }, { status: 502 });
  }

  const proposals: Proposal[] = actions.map((a) => buildProposal(a, state, evalCtx, resolveEmp));
  return NextResponse.json({ reply, proposals });
}

function buildProposal(
  a: AssistantAction,
  state: EvalContext["state"],
  evalCtx: EvalContext,
  resolveEmp: (name: string) => Employee | null,
): Proposal {
  const emp = resolveEmp(a.employee);
  if (!emp) return { op: a.op, summary: `${a.op} ${a.employee}`, events: [], impact: [], blocked: true, reason: `I couldn't find "${a.employee}" on the roster.` };

  if (a.op === "assign") {
    const existing = Object.values(state.shifts).find((s) => s.date === a.date && s.start === a.start && s.end === a.end);
    const shiftId = existing?.id ?? crypto.randomUUID();
    const events: EventToAppend[] = existing
      ? [{ type: "EMPLOYEE_ASSIGNED", payload: { shiftId, employeeId: emp.id } }]
      : [
          { type: "SHIFT_DEFINED", payload: { shiftId, date: a.date, start: a.start, end: a.end, requiredHeadcount: 1, ...(a.role ? { requiredByRole: { [a.role]: 1 } } : {}) } },
          { type: "EMPLOYEE_ASSIGNED", payload: { shiftId, employeeId: emp.id } },
        ];
    // Evaluate against the authority — inject the shift if it's new so the check sees it.
    const hypo: Shift = existing ?? { id: shiftId, date: a.date, start: a.start, end: a.end, requiredHeadcount: 1, requiredByRole: a.role ? { [a.role]: 1 } : {}, assigned: [], status: "draft" };
    const injCtx: EvalContext = { ...evalCtx, state: { ...state, shifts: { ...state.shifts, [shiftId]: hypo } } };
    const verdict = evaluateChange({ kind: "assign", shiftId, employeeId: emp.id }, injCtx);
    return {
      op: "assign",
      summary: `Put ${emp.name} on ${a.date} ${a.start} to ${a.end}${a.role ? ` (${a.role})` : ""}`,
      events,
      impact: verdict.violations.filter((v) => v.kind !== "coverage").map((v) => `${emp.name} ${describeViolation(v)}`),
      blocked: false,
    };
  }

  if (a.op === "unassign") {
    const matches = Object.values(state.shifts).filter(
      (s) => s.date === a.date && s.assigned.includes(emp.id) && (!a.start || s.start === a.start) && (!a.end || s.end === a.end),
    );
    if (matches.length === 0) return { op: "unassign", summary: `Take ${emp.name} off ${a.date}`, events: [], impact: [], blocked: true, reason: `${emp.name} isn't on a shift on ${a.date}.` };
    return {
      op: "unassign",
      summary: `Take ${emp.name} off ${matches.map((s) => `${a.date} ${s.start} to ${s.end}`).join(", ")}`,
      events: matches.map((s) => ({ type: "EMPLOYEE_UNASSIGNED", payload: { shiftId: s.id, employeeId: emp.id } })),
      impact: [],
      blocked: false,
    };
  }

  // time_off — record + approve it (two events), so the person is protected from being scheduled.
  const end = a.endDate && a.endDate >= a.date ? a.endDate : a.date;
  const timeOffId = crypto.randomUUID();
  const verdict = evaluateChange({ kind: "time_off", employeeId: emp.id, start: a.date, end }, evalCtx);
  return {
    op: "time_off",
    summary: `Give ${emp.name} ${a.type === "day_off" ? "the day" : a.type} off ${a.date}${end !== a.date ? ` to ${end}` : ""}`,
    events: [
      { type: "TIMEOFF_REQUESTED", payload: { timeOffId, employeeId: emp.id, type: a.type ?? "day_off", start: a.date, end } },
      { type: "TIMEOFF_APPROVED", payload: { timeOffId } },
    ],
    impact: verdict.violations.map((v) => (v.kind === "coverage" ? "this leaves a coverage gap you'd be overriding" : describeViolation(v))),
    blocked: false,
  };
}
