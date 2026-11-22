import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import {
  assertEndpointUrl,
  endpointSecret,
  EndpointUrlError,
  MAX_ATTEMPTS,
  sendSigned,
  WEBHOOK_EVENTS,
  webhookBody,
} from "@/lib/coach/remote/webhooks";

/**
 * /api/coach/remote/webhooks — a company's webhook endpoints (RSS Phase 9, migration 0286; Gong F31.8). Admins only.
 *   GET   → { configured, endpoints: [{ id, url, events, active, createdAt, last }] }
 *   POST  → { action: "add", url, events } · { action: "secret", endpointId } · { action: "test", endpointId }
 *   PATCH → { endpointId } turns one off (an endpoint is never edited; a new URL is a new endpoint).
 * `configured` is false when RSS_WEBHOOK_SIGNING_SECRET is missing: endpoints can be added, but nothing is sent and
 * the screen says so (§1.5.3: a missing external setting is loud, not silent).
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_APPLIED = "Webhooks are waiting on database migration 0286.";

async function admin(req: NextRequest) {
  const ctx = await resolveApiAuth(req);
  if (!ctx) return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  if (!ctx.isAdmin) return { res: NextResponse.json({ error: "Only a company admin can manage webhooks." }, { status: 403 }) };
  return { ctx };
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-webhooks-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const a = await admin(req);
  if (a.res) return a.res;
  const db = createAdminClient();
  const { data: eps, error } = await db
    .from("webhook_endpoints")
    .select("id, url, events, active, created_at")
    .eq("company_id", a.ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ configured: false, endpoints: [], notReady: NOT_APPLIED });
    console.error(`[webhooks] read failed company=${a.ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load webhooks." }, { status: 500 });
  }
  type Ep = { id: string; url: string; events: string[]; active: boolean; created_at: string };
  const endpoints = (eps ?? []) as Ep[];
  // The latest attempt per endpoint, for "last delivery: 200 OK, 3 minutes ago".
  const last = new Map<string, { ok: boolean; status: number | null; error: string | null; at: string; event: string }>();
  if (endpoints.length) {
    const { data: recent } = await db
      .from("webhook_deliveries")
      .select("id, endpoint_id, event, webhook_attempts(ok, status, error, created_at)")
      .eq("company_id", a.ctx.companyId)
      .in("endpoint_id", endpoints.map((e) => e.id))
      .order("id", { ascending: false })
      .limit(200);
    for (const d of (recent ?? []) as Array<{ endpoint_id: string; event: string; webhook_attempts: Array<{ ok: boolean; status: number | null; error: string | null; created_at: string }> }>) {
      const tries = [...(d.webhook_attempts ?? [])].sort((x, y) => y.created_at.localeCompare(x.created_at));
      const t = tries[0];
      if (!t || last.has(d.endpoint_id)) continue;
      last.set(d.endpoint_id, { ok: t.ok, status: t.status, error: t.error, at: t.created_at, event: d.event });
    }
  }
  return NextResponse.json({
    configured: !!process.env.RSS_WEBHOOK_SIGNING_SECRET,
    events: WEBHOOK_EVENTS,
    maxAttempts: MAX_ATTEMPTS,
    endpoints: endpoints.map((e) => ({ id: e.id, url: e.url, events: e.events, active: e.active, createdAt: e.created_at, last: last.get(e.id) ?? null })),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-webhooks-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const a = await admin(req);
  if (a.res) return a.res;
  const { ctx } = a;
  let b: { action?: unknown; url?: unknown; events?: unknown; endpointId?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const db = createAdminClient();

  if (b.action === "add") {
    let url: string;
    try {
      url = assertEndpointUrl(String(b.url ?? ""));
    } catch (e) {
      if (e instanceof EndpointUrlError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    const events = Array.isArray(b.events) ? [...new Set(b.events.filter((x): x is string => (WEBHOOK_EVENTS as readonly string[]).includes(String(x))))] : [];
    if (events.length === 0) return NextResponse.json({ error: "Pick at least one event to send." }, { status: 400 });
    const { data: row, error } = await db
      .from("webhook_endpoints")
      .insert({ company_id: ctx.companyId, url, events, created_by: ctx.userId })
      .select("id")
      .maybeSingle();
    if (error || !row) {
      if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
      console.error(`[webhooks] add failed company=${ctx.companyId}: ${error?.message}`);
      return NextResponse.json({ error: "Couldn't add the webhook." }, { status: 500 });
    }
    await recordAudit(db, { companyId: ctx.companyId, actorId: ctx.userId, action: "webhook.add", objectType: "webhook_endpoint", objectId: String(row.id), meta: { url, events } });
    return NextResponse.json({ id: row.id });
  }

  const endpointId = typeof b.endpointId === "string" ? b.endpointId : "";
  const { data: ep } = await db
    .from("webhook_endpoints")
    .select("id, url, active")
    .eq("company_id", ctx.companyId)
    .eq("id", endpointId)
    .maybeSingle();
  if (!ep) return NextResponse.json({ error: "Webhook not found." }, { status: 404 });

  let secret: string;
  try {
    secret = endpointSecret(String(ep.id));
  } catch {
    return NextResponse.json({ error: "Webhook signing isn't configured on this server yet, so nothing can be sent." }, { status: 503 });
  }

  if (b.action === "secret") return NextResponse.json({ secret });

  if (b.action === "test") {
    if (!ep.active) return NextResponse.json({ error: "That webhook is off." }, { status: 409 });
    const payload = { message: "A test from Elostate. Verify the signature with your secret; nothing else to do." };
    const { data: delivery, error } = await db
      .from("webhook_deliveries")
      .insert({ company_id: ctx.companyId, endpoint_id: ep.id, event: "ping", payload })
      .select("id, created_at")
      .maybeSingle();
    if (error || !delivery) {
      console.error(`[webhooks] test enqueue failed endpoint=${ep.id}: ${error?.message}`);
      return NextResponse.json({ error: "Couldn't send the test." }, { status: 500 });
    }
    const r = await sendSigned(String(ep.url), secret, webhookBody({ deliveryId: delivery.id, event: "ping", createdAt: delivery.created_at, payload }));
    // Recorded as attempt 1 so the cron does not send the test a second time.
    const { error: attemptError } = await db
      .from("webhook_attempts")
      .insert({ company_id: ctx.companyId, delivery_id: delivery.id, attempt_no: 1, ok: r.ok, status: r.status, error: r.error });
    // Not fatal — the test was sent and its result is returned — but said: without this row the cron sends the ping
    // again (receivers de-duplicate on the delivery id, which is why this is a log and not a 500).
    if (attemptError) console.error(`[webhooks] test attempt not recorded delivery=${delivery.id}: ${attemptError.message}`);
    return NextResponse.json({ ok: r.ok, status: r.status, error: r.error });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-webhooks-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const a = await admin(req);
  if (a.res) return a.res;
  const { ctx } = a;
  let b: { endpointId?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("webhook_endpoints")
    .update({ active: false })
    .eq("company_id", ctx.companyId)
    .eq("id", String(b.endpointId ?? ""))
    .eq("active", true)
    .select("id, url");
  if (error) {
    console.error(`[webhooks] turn off failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't turn it off." }, { status: 500 });
  }
  const row = (rows ?? [])[0] as { id: string; url: string } | undefined;
  if (!row) return NextResponse.json({ error: "Webhook not found, or already off." }, { status: 404 });
  await recordAudit(db, { companyId: ctx.companyId, actorId: ctx.userId, action: "webhook.off", objectType: "webhook_endpoint", objectId: row.id, meta: { url: row.url } });
  return NextResponse.json({ ok: true });
}
