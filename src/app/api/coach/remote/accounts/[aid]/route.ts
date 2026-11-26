import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { AccountReadError, accountDetail } from "@/lib/coach/remote/revenue/accounts";

/**
 * /api/coach/remote/accounts/:aid — one account (revenue Phase 1, 0370; Gong F21.2, F21.3).
 *   GET → { account, deals, contacts, timeline } through the CALLER's client; an account they can't see is a 404.
 *   POST { name } → rename. The caller must be able to SEE the account first (their own client), then the rename runs in
 *        SQL under the account-key lock (rss_account_rename): a name another account of the company already has is a 409.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({ name: z.string().trim().min(1).max(120) });

export async function GET(req: NextRequest, { params }: { params: Promise<{ aid: string }> }) {
  const limited = rateLimit(req, { id: "remote-account-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { aid } = await params;
  if (!UUID.test(aid)) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  try {
    const d = await accountDetail(db, aid);
    if (!d) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json(d);
  } catch (e) {
    if (!(e instanceof AccountReadError)) throw e;
    console.error(`[account] read failed id=${aid}: ${e.message}`);
    return NextResponse.json({ error: "Couldn't load this account." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ aid: string }> }) {
  const limited = rateLimit(req, { id: "remote-account-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { aid } = await params;
  if (!UUID.test(aid)) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: seen, error: sErr } = await db.from("accounts").select("id").eq("id", aid).maybeSingle();
  if (sErr) return NextResponse.json({ error: "Couldn't rename this account." }, { status: 500 });
  if (!seen) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const { data: ok, error } = await createAdminClient().rpc("rss_account_rename", { p_company: ctx.companyId, p_actor: ctx.userId, p_account: aid, p_name: body.name });
  if (error) {
    console.error(`[account] rename failed id=${aid}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't rename this account." }, { status: 500 });
  }
  if (ok === false) return NextResponse.json({ error: "Another account already has that name." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
