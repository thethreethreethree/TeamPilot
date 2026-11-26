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

/**
 * /api/coach/remote/forecast — the forecast board (revenue Phase 6, 0376; Gong M22).
 *   GET ?period=YYYY-Qn → { period, submissions, targets } for that quarter and the one before (accuracy), every row
 *        the caller may see (0376's RLS: their own, a manager's over the tree). The computed columns come from the
 *        pipeline the page already loaded (forecast.ts), so they match it exactly.
 *   POST { kind: "submit", period, category, amount } → the caller's number; the open deals behind it (the
 *        caller's own, expected to close in that quarter) are read here from their pipeline and stored with it, so each
 *        submission is the snapshot accuracy is measured from.
 *   POST { kind: "target", period, userId, amount } → a target (an admin or Sales Coach manager, for themselves or a rep
 *        the tree allows: 0376's policy is the gate).
 */
const PERIOD = /^[0-9]{4}-Q[1-4]$/;
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("submit"), period: z.string().regex(PERIOD), category: z.enum(["commit", "best_case"]), amount: z.number().min(0).max(1e12) }),
  z.object({ kind: z.literal("target"), period: z.string().regex(PERIOD), userId: z.string().uuid(), amount: z.number().min(0).max(1e12) }),
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
    fetchAllPagedResult<{ id: number; user_id: string; period: string; amount: number; created_at: string }>((f, t) => db.from("forecast_targets").select("id, user_id, period, amount, created_at").in("period", periods).order("id").range(f, t), { label: "forecast targets" }),
  ]);
  if (subs.error || targets.error) {
    console.error(`[forecast] read failed company=${ctx.companyId}: ${(subs.error ?? targets.error)?.message}`);
    return NextResponse.json({ error: "Couldn't load the forecast." }, { status: 500 });
  }
  // The latest target per person and quarter.
  const t = new Map<string, { userId: string; period: string; amount: number }>();
  for (const x of targets.data ?? []) t.set(`${x.user_id}|${x.period}`, { userId: x.user_id, period: x.period, amount: Number(x.amount) });
  return NextResponse.json({
    period,
    viewerId: ctx.userId,
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
  if (body.kind === "target") {
    const { error } = await db.from("forecast_targets").insert({ company_id: ctx.companyId, user_id: body.userId, period: body.period, amount: body.amount, set_by: ctx.userId });
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: "Only a manager or admin can set a target, for someone on their team." }, { status: 403 });
      console.error(`[forecast] target failed company=${ctx.companyId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save the target." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  // The snapshot: the caller's own open deals expected to close in the quarter, as they stand now.
  const mine = await listProspects(db, ctx.userId);
  if (!mine) return NextResponse.json({ error: "Couldn't read your pipeline, so the forecast wasn't saved." }, { status: 500 });
  const r = periodRange(body.period);
  const deals = mine
    .filter((p) => p.status === "open" && p.closeDate && p.closeDate >= r.start && p.closeDate <= r.end)
    .slice(0, 500)
    .map((p) => ({ id: p.id, amount: p.amount }));
  const { error } = await db.from("forecast_submissions").insert({
    company_id: ctx.companyId, user_id: ctx.userId, period: body.period, category: body.category, amount: body.amount, deals,
  });
  if (error) {
    console.error(`[forecast] submit failed user=${ctx.userId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save your forecast." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deals: deals.length });
}
