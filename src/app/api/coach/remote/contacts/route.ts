import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { rankOf } from "@/lib/coach/remote/revenue/rank";

/**
 * /api/coach/remote/contacts — people at accounts (revenue Phase 1, 0370).
 *   GET ?q=&accountId= → { contacts } the caller can see (0370's RLS), by name; at most 50.
 *   POST { name, title?, accountId? } → { id } — rss_create_contact as the CALLER (invoker): contacts' insert policy and,
 *        for an account, that the caller can see it, are the gate.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().max(80).optional().nullable(),
  accountId: z.string().regex(UUID).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-contacts-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (accountId && !UUID.test(accountId)) return NextResponse.json({ error: "Unknown account." }, { status: 400 });
  let query = db.from("contacts_current").select("id, name, title, account_id").order("name").order("id").limit(50);
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  if (accountId) query = query.eq("account_id", accountId);
  const { data, error } = await query;
  if (error) {
    console.error(`[contacts] search failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load contacts." }, { status: 500 });
  }
  return NextResponse.json({
    contacts: ((data ?? []) as Array<{ id: string; name: string | null; title: string | null; account_id: string | null }>).map((c) => ({
      id: c.id, name: c.name ?? "(no name)", title: c.title, rank: rankOf(c.title), accountId: c.account_id,
    })),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-contacts-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.rpc("rss_create_contact", { p_name: body.name, p_title: body.title ?? null, p_account: body.accountId ?? null });
  if (error || !data) {
    console.error(`[contacts] create failed company=${ctx.companyId}: ${error?.message ?? "no id"}`);
    // An account the caller can't see fails contact_events' insert policy: say so without confirming it exists.
    return NextResponse.json({ error: body.accountId ? "Couldn't add the contact to that account." : "Couldn't add the contact." }, { status: error?.code === "42501" ? 403 : 500 });
  }
  return NextResponse.json({ id: String(data) });
}
