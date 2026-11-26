import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/coach/remote/contacts/:cid { kind: "name" | "title" | "account" | "email" | "phone", value } — one new fact about a contact, as
 * an EVENT (§3.1), through the CALLER's client: contact_events' insert policy (they can see the contact, and the account
 * for an account change) is the gate; 0370's trigger keeps the account inside the company.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("name"), value: z.string().trim().min(1).max(80) }),
  z.object({ kind: z.literal("title"), value: z.string().trim().max(80).nullable() }),
  z.object({ kind: z.literal("account"), value: z.string().regex(UUID).nullable() }),
  // 0377: where to send an email step and what a call step dials.
  z.object({ kind: z.literal("email"), value: z.string().trim().max(254).email().nullable() }),
  z.object({ kind: z.literal("phone"), value: z.string().trim().regex(/^\+?[0-9 ().-]{6,30}$/).nullable() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const limited = rateLimit(req, { id: "remote-contact-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { cid } = await params;
  if (!UUID.test(cid)) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: c } = await db.from("contacts").select("id, company_id").eq("id", cid).maybeSingle();
  if (!c) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  const value =
    body.kind === "account" ? { account_id: body.value }
    : body.kind === "title" || body.kind === "email" || body.kind === "phone" ? { text: body.value || null }
    : { text: body.value };
  const { error } = await db.from("contact_events").insert({ contact_id: cid, company_id: c.company_id, kind: body.kind, value, actor_id: ctx.userId });
  if (error) {
    console.error(`[contact] event failed id=${cid}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save that change." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
