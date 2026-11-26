import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { loadDealCalls } from "@/lib/coach/remote/revenue/dealCalls";
import { basisKey, basisSessions, type DealBriefBody } from "@/lib/coach/remote/revenue/dealBrief";
import { hiddenFrom } from "@/lib/coach/remote/hidePhrases";
import { writeDealBrief } from "@/lib/coach/remote/revenue/dealBriefRun";

export const maxDuration = 90;

/**
 * /api/coach/remote/prospects/:pid/brief — the deal brief (revenue Phase 3c, 0374; Gong F20.3 Briefs, F20.4 suggested
 * updates).
 *   GET  → { brief, stale, createdAt } — the latest brief, and whether the deal's calls changed since (a new call or a
 *          corrected transcript), so the page can offer a fresh one.
 *   POST → write a brief now from the deal's latest calls (once per basis: the same calls and versions return the
 *          stored one).
 * The deal and its calls are opened through the CALLER's client (prospects', calls' and transcripts' RLS, the tree,
 * hidden calls). The brief is stored with the service role after those reads; every point cites a line (dealBrief.ts).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = new Set(["PGRST205", "42P01"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-deal-brief", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { pid } = await params;
  if (!UUID.test(pid)) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: deal } = await db.from("remote_prospects").select("id").eq("id", pid).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  const { data, error } = await db.from("deal_briefs").select("basis, brief, created_at").eq("prospect_id", pid).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false });
    console.error(`[deal-brief] read failed deal=${pid}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read this deal's brief." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ available: true, brief: null });
  // A brief quotes the calls it was written from (its basis). If any of them is hidden from this reader now, the brief
  // isn't theirs to read: they get none, and may write one from the calls they can hear.
  let hidden: Set<string>;
  try {
    hidden = await hiddenFrom(createAdminClient(), basisSessions(String(data.basis)), ctx.userId);
  } catch {
    return NextResponse.json({ error: "Couldn't read this deal's brief." }, { status: 500 });
  }
  if (hidden.size) return NextResponse.json({ available: true, brief: null });
  const dc = await loadDealCalls(db, pid);
  if (dc === "failed") return NextResponse.json({ error: "Couldn't read this deal's calls." }, { status: 500 });
  return NextResponse.json({ available: true, brief: data.brief as DealBriefBody, createdAt: data.created_at, stale: basisKey(dc.calls) !== data.basis });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const limited = rateLimit(req, { id: "remote-deal-brief-run", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { pid } = await params;
  if (!UUID.test(pid)) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: deal } = await db.from("remote_prospects").select("id, company_id").eq("id", pid).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  const dc = await loadDealCalls(db, pid);
  if (dc === "failed") return NextResponse.json({ error: "Couldn't read this deal's calls." }, { status: 500 });
  if (!dc.linked) return NextResponse.json({ error: "Link calls to this deal first — the brief is read from its calls." }, { status: 409 });
  if (!dc.calls.length) return NextResponse.json({ error: "This deal's calls have no transcripts yet." }, { status: 409 });
  const r = await writeDealBrief(createAdminClient(), { companyId: deal.company_id, prospectId: pid, actorId: ctx.userId, aiCompanyId: ctx.companyId, calls: dc.calls });
  if (r === "suppressed") return NextResponse.json({ error: "The coach isn't answering on this account right now." }, { status: 409 });
  if (r === "unusable") return NextResponse.json({ error: "The brief didn't come back usable — try again." }, { status: 502 });
  if (r === "failed") return NextResponse.json({ error: "The brief couldn't be saved — try again." }, { status: 500 });
  return NextResponse.json({ brief: r.brief, createdAt: r.createdAt, stale: false });
}
