import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { askCoach } from "@/lib/coach/remote/askCoach";

/**
 * /api/coach/remote/on-demand-agents — on-demand agents (Engage plan E9, 0389; Gong F27.2). Through the caller's own
 * client, so RLS decides: everyone in the company reads them; only a sales-coach manager adds or retires one.
 *   GET → { agents: [{ id, name, instruction, created_at }] } — the company's live ones, newest first.
 *   POST { name, instruction } → { id } (managers).
 *   POST { retire: id } → { ok } (managers; retiring is the only change, 0389).
 *   POST { run: id, sessionIds (1-10) } → { answer, citations } | { answer: null, suppressed } — the saved instruction
 *     asked of the deal's calls through Ask Coach as the asker (each call opened with their access; hidden calls stay
 *     hidden). Nothing is acted on and the answer isn't saved.
 */
export const maxDuration = 60;

const Body = z.union([
  z.object({ name: z.string().trim().min(1).max(80), instruction: z.string().trim().min(10).max(1000) }),
  z.object({ retire: z.string().uuid() }),
  z.object({ run: z.string().uuid(), sessionIds: z.array(z.string().uuid()).min(1).max(10) }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "on-demand-agents-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.from("on_demand_agents").select("id, name, instruction, created_at").eq("company_id", ctx.companyId).is("retired_at", null).order("created_at", { ascending: false }).limit(50);
  if (error) {
    console.error(`[on-demand-agents] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load on-demand agents." }, { status: 500 });
  }
  return NextResponse.json({ agents: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "on-demand-agents-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  if ("run" in body) {
    // An AI call each: Ask Coach's own rate (20 a minute), counted separately (the limiter is per instance and per id).
    const runLimited = rateLimit(req, { id: "on-demand-agents-run", windowMs: 60_000, max: 20 });
    if (runLimited) return runLimited;
    const { data: a, error } = await db.from("on_demand_agents").select("id, instruction").eq("company_id", ctx.companyId).eq("id", body.run).is("retired_at", null).maybeSingle();
    if (error) return NextResponse.json({ error: "Couldn't open that agent — try again." }, { status: 500 });
    if (!a) return NextResponse.json({ error: "That agent isn't available (it may have been retired)." }, { status: 404 });
    const r = await askCoach({ db, companyId: ctx.companyId, userId: ctx.userId, sessionIds: body.sessionIds, question: String(a.instruction), chatId: null, save: false });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    if (r.suppressed) return NextResponse.json({ answer: null, suppressed: true });
    return NextResponse.json({ answer: r.answer, citations: r.citations });
  }
  if ("retire" in body) {
    const { data, error } = await db.from("on_demand_agents").update({ retired_at: new Date().toISOString() }).eq("company_id", ctx.companyId).eq("id", body.retire).is("retired_at", null).select("id");
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: "Only a manager or admin can retire on-demand agents." }, { status: 403 });
      console.error(`[on-demand-agents] retire failed company=${ctx.companyId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't retire it." }, { status: 500 });
    }
    // RLS hides a row a non-manager may not update: 0 rows is "not yours to retire, or already retired".
    if (!data?.length) return NextResponse.json({ error: "Not found, already retired, or only a manager can retire it." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await db.from("on_demand_agents").insert({ company_id: ctx.companyId, created_by: ctx.userId, name: body.name, instruction: body.instruction }).select("id").single();
  if (error || !data) {
    if (error?.code === "42501") return NextResponse.json({ error: "Only a manager or admin can make on-demand agents." }, { status: 403 });
    console.error(`[on-demand-agents] create failed company=${ctx.companyId}: ${error?.message}`);
    return NextResponse.json({ error: "Couldn't save it." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
