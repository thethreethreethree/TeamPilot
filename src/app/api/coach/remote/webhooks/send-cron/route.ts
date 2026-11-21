import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { endpointSecret, sendSigned, webhookBody } from "@/lib/coach/remote/webhooks";

/**
 * GET /api/coach/remote/webhooks/send-cron — deliver due webhooks (RSS Phase 9, migration 0286; Gong F31.8).
 * Every 5 minutes (vercel.json). rss_webhook_due picks what to try: not yet delivered, under 6 attempts, past its
 * backoff (1, 2, 4, 8, 16 minutes), from the last 3 days, endpoint still on. Each try is a webhook_attempts row.
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
  if (!process.env.RSS_WEBHOOK_SIGNING_SECRET) {
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
  let delivered = 0;
  let failed = 0;
  for (const d of due) {
    const body = webhookBody({ deliveryId: d.delivery_id, event: d.event, createdAt: d.created_at, payload: d.payload });
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
  return NextResponse.json({ tried: due.length, delivered, failed, bounded: due.length >= BATCH });
}
