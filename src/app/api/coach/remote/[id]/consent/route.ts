import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";

/**
 * /api/coach/remote/:id/consent — the rep confirms the prospect knows this phone/video call is recorded (founder
 * decision 2026-11-22: "Rep confirms at Start"). Live calls now record the prospect's side too, and many places require
 * every party's consent; the rep's confirmation is kept per call as an append-only event (§3.1).
 *   POST { how: "live" | "upload" } → only the rep who took the call confirms it.
 *   GET  → { confirmed: null | { at, how } } for anyone who can see the call.
 */
const Body = z.object({ how: z.enum(["live", "upload"]) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONSENT_KIND = "coach.recording_consent_confirmed";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-consent-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const { data, error } = await db
    .from("events")
    .select("payload, created_at")
    .eq("kind", CONSENT_KIND)
    .eq("subject", `sales_session:${id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[consent] read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read the consent record." }, { status: 500 });
  }
  return NextResponse.json({
    confirmed: data ? { at: data.created_at as string, how: ((data.payload as { how?: string } | null)?.how ?? "live") as "live" | "upload" } : null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-consent-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(session.context)) return NextResponse.json({ error: "Consent is recorded for phone and video calls." }, { status: 400 });
  // Only the person on the call can say the prospect was told.
  if (session.agentId !== ctx.userId) return NextResponse.json({ error: "Only the rep on this call can confirm consent." }, { status: 403 });
  const { error } = await db.from("events").insert({
    company_id: session.companyId,
    actor: ctx.userId,
    kind: CONSENT_KIND,
    subject: `sales_session:${id}`,
    payload: { session_id: id, how: body.how },
  });
  if (error) {
    console.error(`[consent] insert failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't record the confirmation." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
