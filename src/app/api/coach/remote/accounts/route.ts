import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { AccountReadError, listAccounts } from "@/lib/coach/remote/revenue/accounts";

/**
 * /api/coach/remote/accounts — the accounts list (revenue Phase 1, 0370; Gong F21.1).
 *   GET ?scope=mine|team|<repId>&q= → { accounts, capped } through the CALLER's client (0370's RLS: an account is seen by
 *        whoever made it or can see a deal on it; a manager's tree through prospects' own RLS).
 *   POST { name } → { id } — find or make the company's account with that name. The key and the lock live only in SQL
 *        (rss_account_find_or_create, §2.2); it runs with the service role because a matching account the caller can't see
 *        yet must still be found, not duplicated. The company and actor are pinned to the caller (ctx), never the body.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({ name: z.string().trim().min(1).max(120) });

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-accounts-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const scope = req.nextUrl.searchParams.get("scope") || "mine";
  if (scope !== "mine" && scope !== "team" && !UUID.test(scope)) return NextResponse.json({ error: "Unknown scope." }, { status: 400 });
  const db = callerScopedDb(req) ?? (await createClient());
  try {
    const r = await listAccounts(db, ctx.userId, scope, req.nextUrl.searchParams.get("q") ?? undefined);
    return NextResponse.json(r);
  } catch (e) {
    if (!(e instanceof AccountReadError)) throw e;
    console.error(`[accounts] list failed company=${ctx.companyId}: ${e.message}`);
    return NextResponse.json({ error: "Couldn't load accounts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-accounts-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rss_account_find_or_create", { p_company: ctx.companyId, p_actor: ctx.userId, p_name: body.name });
  if (error || !data) {
    console.error(`[accounts] find-or-create failed company=${ctx.companyId}: ${error?.message ?? "no id"}`);
    return NextResponse.json({ error: "Couldn't save that account." }, { status: 500 });
  }
  return NextResponse.json({ id: String(data) });
}
