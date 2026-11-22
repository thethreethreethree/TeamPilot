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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  if (asked && asked !== "team" && !UUID.test(asked)) return NextResponse.json({ error: "Unknown rep." }, { status: 400 });
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
  // One transaction (0304 rss_create_prospect, security invoker): the prospect, its first facts and its call are all
  // written or none is — a failure can no longer leave a nameless prospect behind. A call that is not the caller's
  // own, or is already in a pipeline, refuses the whole thing.
  const { data: id, error } = await db.rpc("rss_create_prospect", {
    p_name: body.name,
    p_organization: body.organization ?? null,
    p_amount: body.amount ?? null,
    p_stage_label: body.stageLabel ?? null,
    p_next_call: body.nextCallDate ?? null,
    p_session: body.sessionId ?? null,
  });
  if (error || !id) {
    if (error?.code === "23505") return NextResponse.json({ error: "That call is already in a pipeline." }, { status: 409 });
    if (error?.code === "42501") {
      return NextResponse.json({ error: body.sessionId ? "Only the rep who took this call can add it to their pipeline." : "Not allowed." }, { status: 403 });
    }
    console.error(`[prospects] create failed user=${ctx.userId}: ${error?.message ?? "no id"}`);
    return NextResponse.json({ error: "Couldn't add the prospect." }, { status: 500 });
  }
  return NextResponse.json({ id: String(id), linked: !!body.sessionId });
}
