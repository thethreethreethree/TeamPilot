import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { REMOTE_CONTEXTS } from "@/lib/coach/sessionContext";
import { dayPlanCoach } from "@/lib/claude";
import { DAY_PLAN_SYSTEM, parseDayPlan, summariseYesterday } from "@/lib/coach/remote/macroMode";
import { listProspects } from "@/lib/coach/remote/prospects";

export const maxDuration = 60;

/**
 * /api/coach/remote/day?day=YYYY-MM-DD — Macro Mode's daily brain dump (MACRO-MODE-SPEC, 0303).
 *   GET  → { plan: null | { dump, items, needleMovers, createdAt }, yesterday, today: { calls, todos } }
 *   POST { day, dump } → organize what the rep wrote into a plan (their items only; two needle movers) and keep it.
 * The day is the REP's calendar day, sent by their browser — the server's UTC date would start "today" at the wrong
 * hour for most reps. Yesterday's numbers are counted from the record, never written by a model. The plan is the
 * rep's own (0303: no manager read).
 */
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.object({ day: Day, dump: z.string().trim().min(1).max(4000), tzOffsetMin: z.number().int().min(-840).max(840).optional() });

/** [start, end) of a calendar day in the rep's zone, as ISO instants. offset = Date.getTimezoneOffset() (minutes). */
function dayBounds(day: string, offsetMin: number): [string, string] {
  const start = Date.parse(`${day}T00:00:00Z`) + offsetMin * 60_000;
  return [new Date(start).toISOString(), new Date(start + 86_400_000).toISOString()];
}
const prevDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-day-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const day = Day.safeParse(req.nextUrl.searchParams.get("day"));
  if (!day.success) return NextResponse.json({ error: "Which day?" }, { status: 400 });
  const offset = Number(req.nextUrl.searchParams.get("tz") ?? 0) || 0;
  const db = callerScopedDb(req) ?? (await createClient());

  const { data: planRow, error: pErr } = await db
    .from("remote_day_plans")
    .select("dump, plan, created_at")
    .eq("rep_id", ctx.userId)
    .eq("day", day.data)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pErr && pErr.code !== "PGRST205" && pErr.code !== "42P01") {
    console.error(`[day] plan read failed user=${ctx.userId}: ${pErr.message}`);
    return NextResponse.json({ error: "Couldn't load your day." }, { status: 500 });
  }

  const [ys, ye] = dayBounds(prevDay(day.data), offset);
  const [calls, scores] = await Promise.all([
    db.from("coaching_sessions").select("id, outcome").eq("agent_id", ctx.userId).in("context", [...REMOTE_CONTEXTS]).gte("started_at", ys).lt("started_at", ye),
    db.from("pitch_scores_by_channel").select("total").eq("rep_id", ctx.userId).in("channel", [...REMOTE_CONTEXTS]).gte("recorded_at", ys).lt("recorded_at", ye),
  ]);
  if (calls.error || scores.error) {
    console.error(`[day] yesterday read failed user=${ctx.userId}: ${calls.error?.message ?? scores.error?.message}`);
    return NextResponse.json({ error: "Couldn't load yesterday's numbers." }, { status: 500 });
  }

  const prospects = await listProspects(db, ctx.userId);
  const todayCalls = (prospects ?? []).filter((p) => p.status === "open" && p.nextCallDate === day.data).map((p) => ({ id: p.id, name: p.name }));
  const todos = (prospects ?? [])
    .filter((p) => p.nextTodo && (p.nextTodo.due === null || p.nextTodo.due <= day.data))
    .map((p) => ({ prospectId: p.id, name: p.name, title: p.nextTodo!.title, due: p.nextTodo!.due, overdue: !!p.nextTodo!.due && p.nextTodo!.due < day.data }));

  const plan = planRow
    ? {
        dump: planRow.dump as string,
        items: ((planRow.plan as { items?: unknown })?.items ?? []) as Array<{ time: string | null; what: string }>,
        needleMovers: ((planRow.plan as { needle_movers?: unknown })?.needle_movers ?? []) as string[],
        createdAt: planRow.created_at as string,
      }
    : null;
  return NextResponse.json({
    available: !pErr,
    plan,
    yesterday: summariseYesterday((calls.data ?? []) as Array<{ outcome: string | null }>, (scores.data ?? []) as Array<{ total: number | null }>),
    today: { calls: todayCalls, todos, pipelineFailed: prospects === null },
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-day-write", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());

  const r = await dayPlanCoach({
    companyId: ctx.companyId,
    systemPrompt: DAY_PLAN_SYSTEM,
    userMessage: `Today is ${body.day}. What I wrote:\n"""\n${body.dump}\n"""`,
  });
  // If the model is off or fails, the rep's own words are still kept: the brain dump is theirs either way.
  const plan = r.suppressed ? null : parseDayPlan(r.text, body.dump);
  const { error } = await db.from("remote_day_plans").insert({
    company_id: ctx.companyId,
    rep_id: ctx.userId,
    day: body.day,
    dump: body.dump,
    plan: plan ? { items: plan.items, needle_movers: plan.needleMovers } : {},
  });
  if (error) {
    console.error(`[day] plan store failed user=${ctx.userId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save your plan." }, { status: 500 });
  }
  return NextResponse.json({ plan: plan ?? { items: [], needleMovers: [] }, organized: !!plan });
}
