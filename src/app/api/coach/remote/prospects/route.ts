import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { coOwnedDealIds, shareTotals, splitsFor } from "@/lib/coach/remote/revenue/dealSplits";
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
  // Lead source (0313), e.g. "Webinar", "Referral".
  source: z.string().trim().max(60).optional(),
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
  const rows = await listProspects(db, repId, { sentiment: true });
  if (rows === null) return NextResponse.json({ error: "Couldn't load the pipeline." }, { status: 500 });
  // Revenue phase 10 (0394): each deal's split, so the forecast counts each owner's share. A failed read is a 500 —
  // per-person amounts without it would be wrong, not just incomplete.
  const splits = await splitsFor(db, rows);
  if (splits === null) return NextResponse.json({ error: "Couldn't load the pipeline." }, { status: 500 });
  for (const r of rows) r.split = splits.get(r.id) ?? null;
  // 0395 (founder picker "Co-owners see deals they co-own"): on your own pipeline, the deals you co-own but aren't the
  // rep on — read with the service role after the co-owner check, pinned to your company — for your forecast board.
  // Kept apart from the list: they're not your deals to work.
  let coOwned: typeof rows = [];
  if (repId === ctx.userId) {
    const admin = createAdminClient();
    const ids = await coOwnedDealIds(admin, ctx.userId);
    if (ids === null) return NextResponse.json({ error: "Couldn't load the pipeline." }, { status: 500 });
    const mine = new Set(rows.map((r) => r.id));
    const others = ids.filter((id) => !mine.has(id));
    if (others.length) {
      const extra = await listProspects(admin, undefined, { companyId: ctx.companyId, ids: others });
      const extraSplits = extra ? await splitsFor(admin, extra) : null;
      if (!extra || !extraSplits) return NextResponse.json({ error: "Couldn't load the pipeline." }, { status: 500 });
      // No signals or sentiment on someone else's deal (review 2026-11-28): they're read from its calls with the service
      // role, which a hide doesn't stop — a call hidden from you must not shape what you see.
      for (const r of extra) {
        r.split = extraSplits.get(r.id) ?? null;
        r.signals = undefined;
        r.sentiment = null;
      }
      coOwned = extra;
    }
  }
  // Revenue phase 10b: your own pipeline's totals are your share of what you own and co-own (a team view's are whole).
  const own = repId === ctx.userId ? shareTotals([...rows.map((r) => ({ ...r, repId: ctx.userId })), ...coOwned], ctx.userId) : null;
  return NextResponse.json({ prospects: rows, coOwned, totals: own ? own.totals : pipelineTotals(rows), totalsByShare: own?.split === true, repId: repId ?? "team", viewerId: ctx.userId });
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
    p_source: body.source || null,
  });
  if (error || !id) {
    if (error?.code === "23505") return NextResponse.json({ error: "That call is already in a pipeline." }, { status: 409 });
    if (error?.code === "42501") {
      return NextResponse.json({ error: body.sessionId ? "Only the rep who took this call can add it to their pipeline." : "Not allowed." }, { status: 403 });
    }
    console.error(`[prospects] create failed user=${ctx.userId}: ${error?.message ?? "no id"}`);
    return NextResponse.json({ error: "Couldn't add the prospect." }, { status: 500 });
  }
  // Revenue Phase 1 (0370): a company named on a new deal is its account, found or made by the company-wide key.
  if (body.organization?.trim()) {
    const { data: acc, error: aErr } = await createAdminClient().rpc("rss_account_find_or_create", { p_company: ctx.companyId, p_actor: ctx.userId, p_name: body.organization.trim().slice(0, 120) });
    const { error: eErr } = acc && !aErr
      ? await db.from("remote_prospect_events").insert({ prospect_id: String(id), company_id: ctx.companyId, kind: "account", value: { account_id: String(acc) }, actor_id: ctx.userId })
      : { error: aErr ?? { message: "no account id" } };
    if (eErr) {
      // Said, not swallowed: the deal exists, but without its account it won't show on the account page.
      console.error(`[prospects] account not set prospect=${String(id)}: ${eErr.message}`);
      return NextResponse.json({ id: String(id), linked: !!body.sessionId, error: "The prospect was added, but its account couldn't be set. Set it from the prospect." }, { status: 500 });
    }
  }
  return NextResponse.json({ id: String(id), linked: !!body.sessionId });
}
