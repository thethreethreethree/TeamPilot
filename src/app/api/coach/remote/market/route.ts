import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { contextsOf } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { computeMarket, type Intel, type MarketCall } from "@/lib/coach/remote/market";

/**
 * GET /api/coach/remote/market?module=remote_sales|sales_coach&days=30|90 — competitors and topics across the calls in
 * view, and how deals go when a competitor comes up (2026-11-23, market.ts). Calls are read through the CALLER's client
 * (a manager's tree, a rep's own), sales calls only (isSalesCall); each call's latest intel event is used. A failed
 * read is a 500 — a market view built on part of the calls would misstate which competitors matter.
 */
const CHUNK = 100;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-market", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const callModule = sp.get("module") === "sales_coach" ? "sales_coach" : "remote_sales";
  const days = sp.get("days") === "30" ? 30 : 90;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = callerScopedDb(req) ?? (await createClient());
  const fail = (what: string, msg?: string) => {
    console.error(`[market] ${what} failed company=${ctx.companyId}: ${msg ?? ""}`);
    return NextResponse.json({ error: "Couldn't build the market view." }, { status: 500 });
  };

  const sessions = await fetchAllPagedResult<{ id: string; started_at: string; outcome: string | null; session_kind: string | null }>(
    (from, to) =>
      db.from("coaching_sessions").select("id, started_at, outcome, session_kind").in("context", [...contextsOf(callModule)]).gte("started_at", since).order("started_at").order("id").range(from, to),
    { label: "market sessions" },
  );
  if (sessions.error) return fail("sessions", sessions.error.message);
  const calls: MarketCall[] = (sessions.data ?? []).filter((s) => isSalesCall(s.session_kind)).map((s) => ({ sessionId: s.id, startedAt: s.started_at, outcome: s.outcome }));

  const intel = new Map<string, Intel>();
  const subjects = calls.map((c) => `sales_session:${c.sessionId}`);
  for (let i = 0; i < subjects.length; i += CHUNK) {
    const ev = await fetchAllPagedResult<{ subject: string; payload: { intel?: { competitors?: unknown; topics?: unknown } } | null; created_at: string; id: string }>(
      (from, to) =>
        db.from("events").select("subject, payload, created_at, id").eq("kind", "coach.session_intel_generated").in("subject", subjects.slice(i, i + CHUNK)).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
      { label: "market intel" },
    );
    if (ev.error) return fail("intel", ev.error.message);
    for (const e of ev.data ?? []) {
      const sid = String(e.subject).replace("sales_session:", "");
      if (intel.has(sid)) continue; // newest first: the call's latest intel wins
      const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);
      intel.set(sid, { competitors: list(e.payload?.intel?.competitors), topics: list(e.payload?.intel?.topics) });
    }
  }
  return NextResponse.json({ module: callModule, days, ...computeMarket(calls, intel) });
}
