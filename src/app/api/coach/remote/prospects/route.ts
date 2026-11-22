import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { listProspects } from "@/lib/coach/remote/prospects";
import { pipelineTotals } from "@/lib/coach/remote/macroMode";

/**
 * /api/coach/remote/prospects — the Remote Sales pipeline (Macro Mode, 0303).
 *   GET ?repId= → { prospects, totals: { open, won, lost: { count, amount } } } — the caller's own by default; a manager
 *                 may pass a report's id (RLS decides; another rep's id returns nothing, never an error that confirms
 *                 they exist). ?repId=team → every prospect the caller may see (a manager's whole tree).
 *   POST { name, organization?, amount?, stageLabel?, nextCallDate?, sessionId? } → a new prospect of the caller's
 *                 own, its first facts as events, and optionally the call it came from.
 * Writes go through the caller's client: 0303's insert policies are the gate.
 */
const Body = z.object({
  name: z.string().trim().min(1).max(120),
  organization: z.string().trim().max(120).optional(),
  amount: z.number().min(0).max(1e10).optional(),
  stageLabel: z.string().trim().max(60).optional(),
  nextCallDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sessionId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-prospects-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const asked = req.nextUrl.searchParams.get("repId");
  const repId = asked === "team" ? undefined : asked || ctx.userId;
  const rows = await listProspects(db, repId);
  if (rows === null) return NextResponse.json({ error: "Couldn't load the pipeline." }, { status: 500 });
  return NextResponse.json({ prospects: rows, totals: pipelineTotals(rows), repId: repId ?? "team", viewerId: ctx.userId });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-prospects-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());

  const { data: p, error } = await db
    .from("remote_prospects")
    .insert({ company_id: ctx.companyId, rep_id: ctx.userId, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !p) {
    console.error(`[prospects] create failed user=${ctx.userId}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't add the prospect." }, { status: 500 });
  }
  const events: Array<{ kind: string; value: Record<string, unknown> }> = [{ kind: "name", value: { text: body.name } }];
  if (body.organization) events.push({ kind: "organization", value: { text: body.organization } });
  events.push({ kind: "stage", value: { status: "open", ...(body.stageLabel ? { label: body.stageLabel } : {}) } });
  if (body.amount !== undefined) events.push({ kind: "amount", value: { amount: body.amount } });
  if (body.nextCallDate) events.push({ kind: "next_call", value: { date: body.nextCallDate } });
  const { error: eErr } = await db
    .from("remote_prospect_events")
    .insert(events.map((e) => ({ prospect_id: p.id, company_id: ctx.companyId, kind: e.kind, value: e.value, actor_id: ctx.userId })));
  if (eErr) {
    console.error(`[prospects] first facts failed prospect=${p.id}: ${eErr.message}`);
    return NextResponse.json({ error: "The prospect was added but its details didn't save. Open it and add them again." }, { status: 500 });
  }
  let linked = false;
  if (body.sessionId) {
    const { error: cErr } = await db
      .from("remote_prospect_calls")
      .insert({ prospect_id: p.id, session_id: body.sessionId, company_id: ctx.companyId, linked_by: ctx.userId });
    if (cErr) console.error(`[prospects] call link failed prospect=${p.id}: ${cErr.message}`);
    linked = !cErr;
  }
  return NextResponse.json({ id: String(p.id), linked });
}
