import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { AccountReadError, contactsOfCall } from "@/lib/coach/remote/revenue/accounts";

/**
 * /api/coach/remote/:id/contacts — who was on this call (revenue Phase 1, 0370; Gong F29.1, by hand since there is no
 * CRM to match against, plan R2).
 *   GET → { contacts, accountId } — the call's linked contacts, and the account of the deal the call is on (if any), so
 *        a new contact can be created there.
 *   POST { contactId, linked } → link or unlink, as an appended row (latest per pair wins, §3.1), through the CALLER's
 *        client: call_contacts' insert policy (they can see the call and the contact) is the gate.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({ contactId: z.string().regex(UUID), linked: z.boolean() });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-call-contacts-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: s } = await db.from("coaching_sessions").select("id").eq("id", id).maybeSingle();
  if (!s) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  try {
    const contacts = await contactsOfCall(db, id);
    const { data: link, error: lErr } = await db.from("remote_prospect_calls").select("prospect_id").eq("session_id", id).maybeSingle();
    if (lErr) throw new AccountReadError(`deal link: ${lErr.message}`);
    let accountId: string | null = null;
    if (link?.prospect_id) {
      const { data: p, error: pErr } = await db.from("remote_prospects_current").select("account_id").eq("id", link.prospect_id).maybeSingle();
      if (pErr) throw new AccountReadError(`deal: ${pErr.message}`);
      accountId = (p?.account_id as string | null) ?? null;
    }
    return NextResponse.json({ contacts, accountId, dealId: (link?.prospect_id as string | null) ?? null });
  } catch (e) {
    if (!(e instanceof AccountReadError)) throw e;
    console.error(`[call-contacts] read failed session=${id}: ${e.message}`);
    return NextResponse.json({ error: "Couldn't load who was on this call." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-call-contacts-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: s } = await db.from("coaching_sessions").select("id, company_id").eq("id", id).maybeSingle();
  if (!s) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const { error } = await db.from("call_contacts").insert({ session_id: id, contact_id: body.contactId, company_id: s.company_id, linked: body.linked, actor_id: ctx.userId });
  if (error) {
    console.error(`[call-contacts] link failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save who was on this call." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
