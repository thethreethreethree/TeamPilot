import { NextRequest, NextResponse } from "next/server";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { listProspects } from "@/lib/coach/remote/prospects";
import { periodRange, shiftPeriod } from "@/lib/coach/remote/revenue/forecast";
import { coOwnedDealIds, shareOf, splitsFor } from "@/lib/coach/remote/revenue/dealSplits";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /api/coach/remote/forecast — the forecast board (revenue Phase 6, 0376; Gong M22).
 *   GET ?period=YYYY-Qn → { period, submissions, targets } for that quarter and the one before (accuracy), every row
 *        the caller may see (0376's RLS: their own, a manager's over the tree). The computed columns come from the
 *        pipeline the page already loaded (forecast.ts), so they match it exactly.
 *   POST { kind: "submit", period, category, amount } → the caller's number; the open deals behind it (the
 *        caller's own, expected to close in that quarter) are read here from their pipeline and stored with it, so each
 *        submission is the snapshot accuracy is measured from.
 *   POST { kind: "due_day", weekday } → the weekday forecasts are due (0391; company admins). GET carries
 *        dueWeekday and canSetDue.
 *   POST { kind: "target", period, userId, amount } → a target (an admin or Sales Coach manager, for themselves or a rep
 *        the tree allows: 0376's policy is the gate).
 */
const PERIOD = /^[0-9]{4}-Q[1-4]$/;
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("submit"), period: z.string().regex(PERIOD), category: z.enum(["commit", "best_case"]), amount: z.number().min(0).max(1e12) }),
  // team (0386, revenue phase 7): the target is for userId's team (their reporting tree), not for them alone.
  z.object({ kind: z.literal("target"), period: z.string().regex(PERIOD), userId: z.string().uuid(), amount: z.number().min(0).max(1e12), team: z.boolean().optional() }),
  // 0391 (revenue phase 8; Gong F22.4): the weekday forecasts are due (0 Sunday … 6 Saturday). Company admins only.
  z.object({ kind: z.literal("due_day"), weekday: z.number().int().min(0).max(6) }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-forecast-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const period = req.nextUrl.searchParams.get("period") ?? "";
  if (!PERIOD.test(period)) return NextResponse.json({ error: "Which quarter?" }, { status: 400 });
  const periods = [period, shiftPeriod(period, -1)];
  const db = callerScopedDb(req) ?? (await createClient());
  // Every row, oldest first (the latest per person wins below; a capped read would silently drop the newest).
  const [subs, targets] = await Promise.all([
    fetchAllPagedResult<{ id: number; user_id: string; period: string; category: string; amount: number; deals: Array<{ id: string; amount: number | null }> | null; created_at: string }>((f, t) => db.from("forecast_submissions").select("id, user_id, period, category, amount, deals, created_at").in("period", periods).order("id").range(f, t), { label: "forecast submissions" }),
    fetchAllPagedResult<{ id: number; user_id: string; period: string; amount: number; for_team: boolean | null; created_at: string }>((f, t) => db.from("forecast_targets").select("id, user_id, period, amount, for_team, created_at").in("period", periods).order("id").range(f, t), { label: "forecast targets" }),
  ]);
  if (subs.error || targets.error) {
    console.error(`[forecast] read failed company=${ctx.companyId}: ${(subs.error ?? targets.error)?.message}`);
    return NextResponse.json({ error: "Couldn't load the forecast." }, { status: 500 });
  }
  // 0391: the company's due weekday (Monday when unset or unreadable — the board says it either way).
  const { data: co, error: coErr } = await db.from("companies").select("forecast_due_weekday").eq("id", ctx.companyId).maybeSingle();
  if (coErr) console.error(`[forecast] due day read failed company=${ctx.companyId}: ${coErr.message}`);
  // null = couldn't be read; the board says so rather than showing a default as if it were the setting.
  const dueWeekday = typeof co?.forecast_due_weekday === "number" ? co.forecast_due_weekday : null;
  // The latest target per person (or team), and quarter.
  const t = new Map<string, { userId: string; period: string; amount: number; team?: boolean }>();
  for (const x of targets.data ?? []) t.set(`${x.user_id}|${x.period}|${x.for_team ? "team" : "person"}`, { userId: x.user_id, period: x.period, amount: Number(x.amount), ...(x.for_team ? { team: true } : {}) });
  return NextResponse.json({
    period,
    viewerId: ctx.userId,
    dueWeekday,
    canSetDue: ctx.isAdmin,
    submissions: (subs.data ?? []).map((x) => ({
      userId: x.user_id, period: x.period, category: x.category, amount: Number(x.amount), createdAt: x.created_at,
      // The open deals behind the number when it was submitted (F22.3); names come from the deals the reader can see.
      deals: Array.isArray(x.deals) ? x.deals.map((d) => ({ id: String(d.id), amount: d.amount === null ? null : Number(d.amount) })) : [],
    })),
    targets: [...t.values()],
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-forecast-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  if (body.kind === "due_day") {
    // Company admins (isAdminRole), as 0391's guard trigger enforces again in the database.
    if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can change when forecasts are due." }, { status: 403 });
    const { error } = await db.from("companies").update({ forecast_due_weekday: body.weekday }).eq("id", ctx.companyId);
    if (error) {
      console.error(`[forecast] due day failed company=${ctx.companyId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save the due day." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  if (body.kind === "target") {
    // A team target is the caller's own team's (review 2026-11-27): a manager sets theirs; one on a rep means nothing.
    if (body.team && body.userId !== ctx.userId) return NextResponse.json({ error: "A team target is set for your own team." }, { status: 400 });
    const { error } = await db.from("forecast_targets").insert({ company_id: ctx.companyId, user_id: body.userId, period: body.period, amount: body.amount, set_by: ctx.userId, for_team: body.team === true });
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: "Only a manager or admin can set a target, for someone on their team." }, { status: 403 });
      console.error(`[forecast] target failed company=${ctx.companyId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save the target." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  // The snapshot: the caller's own open deals expected to close in the quarter, as they stand now.
  const own = await listProspects(db, ctx.userId);
  if (!own) return NextResponse.json({ error: "Couldn't read your pipeline, so the forecast wasn't saved." }, { status: 500 });
  // 0394/0395: the deals behind the number are the caller's share of every deal they own or co-own — the same share the
  // board's Closed won counts (shareOf), so accuracy compares like with like.
  const admin = createAdminClient();
  const coIds = await coOwnedDealIds(admin, ctx.userId);
  if (coIds === null) return NextResponse.json({ error: "Couldn't read your pipeline, so the forecast wasn't saved." }, { status: 500 });
  const ownIds = new Set(own.map((p) => p.id));
  const co = coIds.filter((id) => !ownIds.has(id)).length ? await listProspects(admin, undefined, { companyId: ctx.companyId, ids: coIds.filter((id) => !ownIds.has(id)) }) : [];
  const all = [...own, ...(co ?? [])];
  const splits = co === null ? null : await splitsFor(admin, all);
  if (!splits) return NextResponse.json({ error: "Couldn't read your pipeline, so the forecast wasn't saved." }, { status: 500 });
  const r = periodRange(body.period);
  const deals = all
    .filter((p) => p.status === "open" && p.closeDate && p.closeDate >= r.start && p.closeDate <= r.end)
    // An own deal was read by rep_id, so its rep is the caller; a co-owned one is someone else's.
    .map((p) => ({ p, share: shareOf({ repId: ownIds.has(p.id) ? ctx.userId : p.repId, split: splits.get(p.id) ?? null }, ctx.userId) }))
    .filter((x) => x.share > 0)
    .slice(0, 500)
    .map(({ p, share }) => ({ id: p.id, amount: p.amount === null ? null : Math.round(p.amount * share * 100) / 100 }));
  const { error } = await db.from("forecast_submissions").insert({
    company_id: ctx.companyId, user_id: ctx.userId, period: body.period, category: body.category, amount: body.amount, deals,
  });
  if (error) {
    console.error(`[forecast] submit failed user=${ctx.userId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save your forecast." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deals: deals.length });
}
