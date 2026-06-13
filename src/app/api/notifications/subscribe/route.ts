import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST   /api/notifications/subscribe — register a push subscription
 * DELETE /api/notifications/subscribe — unregister by endpoint
 *
 * Team Chat PWA — Phase 2.1 (subscription endpoint).
 *
 * The browser's PushManager.subscribe() returns a PushSubscription
 * with an opaque endpoint URL + crypto keys. We persist that to
 * notification_subscriptions so the server-side fan-out (Phase 2.2)
 * can encrypt + deliver payloads to it when relevant events fire.
 *
 * The endpoint is globally unique by the Web Push spec — re-registers
 * from the same browser update the existing row rather than creating
 * duplicates.
 */

const SubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "notifications-subscribe",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const body = await readBody(req, SubscribeSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "No company context" },
      { status: 400 }
    );
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  // Upsert by endpoint — same browser re-registering updates the
  // existing row instead of creating a duplicate.
  const { error } = await supabase
    .from("notification_subscriptions")
    .upsert(
      {
        user_id: auth.user.id,
        company_id: companyId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: userAgent,
        enabled: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscribed: true });
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "notifications-unsubscribe",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const body = await readBody(req, UnsubscribeSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS limits the delete to rows owned by the calling user even
  // though we match by endpoint — defense in depth.
  const { error } = await supabase
    .from("notification_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ unsubscribed: true });
}
