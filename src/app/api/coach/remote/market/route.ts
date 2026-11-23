import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { computeMarket } from "@/lib/coach/remote/market";
import { readMarketInputs, readTopicGroups } from "@/lib/coach/remote/marketRead";

/**
 * GET /api/coach/remote/market?module=remote_sales|sales_coach&days=30|90 — competitors and topics across the calls in
 * view, and how deals go when a competitor comes up (2026-11-23, market.ts). Calls are read through the CALLER's client
 * (a manager's tree, a rep's own), sales calls only (isSalesCall); each call's latest intel event is used (marketRead.ts).
 * Topics are counted with the company's manager-accepted topic groups (0319). A failed read is a 500 — a market view
 * built on part of the calls would misstate which competitors matter.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-market", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const callModule = sp.get("module") === "sales_coach" ? "sales_coach" : "remote_sales";
  const days = sp.get("days") === "30" ? 30 : 90;
  const db = callerScopedDb(req) ?? (await createClient());
  const fail = (what: string, msg?: string) => {
    console.error(`[market] ${what} failed company=${ctx.companyId}: ${msg ?? ""}`);
    return NextResponse.json({ error: "Couldn't build the market view." }, { status: 500 });
  };
  const [inputs, groups] = await Promise.all([readMarketInputs(db, callModule, days), readTopicGroups(db, ctx.companyId)]);
  if (!inputs.ok) return fail(inputs.what, inputs.message);
  if (!groups.ok) return fail("topic groups", groups.message);
  return NextResponse.json({ module: callModule, days, ...computeMarket(inputs.calls, inputs.intel, 15, groups.groups) });
}
