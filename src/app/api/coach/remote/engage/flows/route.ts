import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { checkSteps, FlowError, type Step } from "@/lib/coach/remote/engage/flows";

/**
 * /api/coach/remote/engage/flows — Engage flows (plan E1, 0377; Gong M24).
 *   GET → { flows } — the company's live flows and your own (RLS).
 *   POST { name, isCompany, steps } → a new flow (company flows: admins and Sales Coach managers, by 0377's policy).
 *   POST { retire: flowId } → retire it (the one change a flow allows; enrolments already in it keep running).
 */
const StepZ = z.object({
  kind: z.enum(["email", "call", "task"]),
  delay: z.object({ amount: z.number().int().min(0), unit: z.enum(["hours", "business_days"]) }),
  title: z.string().trim().min(1).max(120),
  body: z.string().max(4000).optional(),
});
const Body = z.union([
  z.object({ name: z.string().trim().min(1).max(80), isCompany: z.boolean(), steps: z.array(StepZ).min(1).max(15) }),
  z.object({ retire: z.string().uuid() }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "engage-flows-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.from("engage_flows").select("id, name, is_company, steps, owner_id, created_at").is("retired_at", null).order("created_at", { ascending: false }).limit(200);
  if (error) {
    console.error(`[engage-flows] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load your flows." }, { status: 500 });
  }
  return NextResponse.json({
    flows: ((data ?? []) as Array<{ id: string; name: string; is_company: boolean; steps: Step[]; owner_id: string }>).map((f) => ({ id: f.id, name: f.name, isCompany: f.is_company, steps: f.steps, mine: f.owner_id === ctx.userId })),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "engage-flows-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  if ("retire" in body) {
    const { data, error } = await db.from("engage_flows").update({ retired_at: new Date().toISOString() }).eq("id", body.retire).is("retired_at", null).select("id");
    if (error) {
      console.error(`[engage-flows] retire failed id=${body.retire}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't retire that flow." }, { status: 500 });
    }
    if (!data?.length) return NextResponse.json({ error: "Flow not found, or not one you can retire." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  let steps: Step[];
  try {
    steps = checkSteps(body.steps.map((s) => ({ ...s, body: s.body ?? "" })));
  } catch (e) {
    if (e instanceof FlowError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { data, error } = await db.from("engage_flows").insert({ company_id: ctx.companyId, owner_id: ctx.userId, name: body.name, is_company: body.isCompany, steps }).select("id").single();
  if (error || !data) {
    if (error?.code === "42501") return NextResponse.json({ error: "Only a manager or admin can make a company flow — save it as your own." }, { status: 403 });
    console.error(`[engage-flows] create failed company=${ctx.companyId}: ${error?.message}`);
    return NextResponse.json({ error: "Couldn't save the flow." }, { status: 500 });
  }
  return NextResponse.json({ id: String(data.id) });
}
