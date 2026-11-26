import { NextRequest, NextResponse } from "next/server";
import { buildCrmCall } from "@/lib/coach/remote/crmExport";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { endpointSecret, sendSigned, webhookBody, webhooksConfigured } from "@/lib/coach/remote/webhooks";

/**
 * GET /api/coach/remote/webhooks/send-cron — deliver due webhooks (RSS Phase 9, migration 0286; Gong F31.8).
 * Every 5 minutes (vercel.json). rss_webhook_due picks what to try: not yet delivered, under 6 attempts, past its
 * backoff (1, 2, 4, 8, 16 minutes), from the last 3 days, endpoint still on. Each try is a webhook_attempts row, and
 * is claimed first (0384 webhook_send_claims) so overlapping runs never send one attempt twice.
 * Fails LOUD (503) without CRON_SECRET or RSS_WEBHOOK_SIGNING_SECRET — an unsigned webhook is never sent.
 */
export const maxDuration = 300;
const BATCH = 50;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not set — webhook sending disabled until configured." }, { status: 503 });
  if (!constantTimeEqual(req.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!webhooksConfigured()) {
    return NextResponse.json({ error: "RSS_WEBHOOK_SIGNING_SECRET not set — webhooks are queued but not sent." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rss_webhook_due", { p_limit: BATCH });
  if (error) {
    console.error("[webhooks/send-cron] due query failed:", error.message);
    return NextResponse.json({ error: "Webhook queue unreadable." }, { status: 500 });
  }
  type Due = { delivery_id: number; company_id: string; endpoint_id: string; url: string; event: string; payload: unknown; created_at: string; attempts: number };
  const due = (data ?? []) as Due[];
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://elostate.com";
  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  for (const d of due) {
    // Claim this attempt before sending (0384): two overlapping runs both see it due, and only the claim's winner sends.
    const { error: cErr } = await admin.from("webhook_send_claims").insert({ delivery_id: d.delivery_id, attempt_no: d.attempts + 1, company_id: d.company_id });
    if (cErr) {
      if (cErr.code !== "23505") console.error(`[webhooks/send-cron] claim failed delivery=${d.delivery_id}: ${cErr.message}`);
      // A claim with no attempt recorded after STALE_CLAIM_MS: the run that took it stopped before sending. Record that
      // attempt as failed, so the delivery moves on to its next attempt instead of being stuck behind the claim forever.
      else await closeStaleClaim(admin, d);
      skipped += 1; // another run has it, or the claim couldn't be written (never send unclaimed)
      continue;
    }
    // call.to_crm (0330): the queue holds only the call's id; the content is assembled now, so it is current and an
    // erased call sends only what is left.
    let payload = d.payload;
    if (d.event === "call.to_crm") {
      const sid = (d.payload as { sessionId?: unknown } | null)?.sessionId;
      const built = typeof sid === "string" ? await buildCrmCall(admin, d.company_id, sid, origin) : null;
      payload = built ?? { call: { id: sid ?? null }, missing: true };
    }
    const body = webhookBody({ deliveryId: d.delivery_id, event: d.event, createdAt: d.created_at, payload });
    const r = await sendSigned(d.url, endpointSecret(d.endpoint_id), body);
    const { error: aErr } = await admin.from("webhook_attempts").insert({
      company_id: d.company_id,
      delivery_id: d.delivery_id,
      attempt_no: d.attempts + 1,
      ok: r.ok,
      status: r.status,
      error: r.error,
    });
    // 23505: an overlapping run already recorded this attempt number; its result stands.
    if (aErr && aErr.code !== "23505") console.error(`[webhooks/send-cron] attempt not recorded delivery=${d.delivery_id}: ${aErr.message}`);
    if (r.ok) delivered += 1;
    else failed += 1;
  }
  return NextResponse.json({ tried: due.length, delivered, failed, skipped, bounded: due.length >= BATCH });
}

/** Longer than a run's whole budget (maxDuration 300 s): a claim this old with no attempt belongs to a run that died. */
const STALE_CLAIM_MS = 10 * 60_000;

async function closeStaleClaim(admin: ReturnType<typeof createAdminClient>, d: { delivery_id: number; company_id: string; attempts: number }) {
  const { data: claim, error } = await admin.from("webhook_send_claims").select("created_at").eq("company_id", d.company_id).eq("delivery_id", d.delivery_id).eq("attempt_no", d.attempts + 1).maybeSingle();
  if (error || !claim || Date.now() - Date.parse(String(claim.created_at)) < STALE_CLAIM_MS) return;
  const { error: aErr } = await admin.from("webhook_attempts").insert({
    company_id: d.company_id, delivery_id: d.delivery_id, attempt_no: d.attempts + 1, ok: false, status: null,
    error: "Claimed by a run that stopped before sending; retried as the next attempt.",
  });
  if (aErr && aErr.code !== "23505") console.error(`[webhooks/send-cron] stale claim not closed delivery=${d.delivery_id}: ${aErr.message}`);
}
