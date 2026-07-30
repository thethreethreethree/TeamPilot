import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * GET  /api/me/care-notifications  — the caller's C.A.R.E notification preferences.
 * PATCH /api/me/care-notifications — { customerReply?: boolean }
 *
 * Comprehensive settings pillar 3. Per-user, self-scoped (profiles RLS = id: auth.uid()), modelled on
 * /api/me/theme (A28). A34-guarded: if migration 0204 is not applied, GET returns the default (true) with
 * degraded:true, and PATCH returns a soft 409 — nothing breaks, and the send path keeps notifying.
 *
 * Today there is one C.A.R.E push event (assigned-agent customer reply), so one preference. Add more keys
 * here as more C.A.R.E events gain pushes.
 */

const PatchSchema = z.object({ customerReply: z.boolean().optional() }).strict();

export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("profiles")
    .select("care_notify_customer_reply")
    .eq("id", ctx.userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error, "care_notify_customer_reply")) {
      // Migration 0204 not applied yet — report the effective default, flag degraded.
      return NextResponse.json({ customerReply: true, degraded: true });
    }
    console.error("[me/care-notifications GET] failed to read preference:", error);
    return NextResponse.json({ error: "Couldn't load your notification preference." }, { status: 500 });
  }

  // null (unset) defaults to true — the send path notifies unless explicitly opted out.
  const customerReply = (data?.care_notify_customer_reply as boolean | null) ?? true;
  return NextResponse.json({ customerReply });
}

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;
  if (body.customerReply === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await sb
    .from("profiles")
    .update({ care_notify_customer_reply: body.customerReply })
    .eq("id", ctx.userId);

  if (error) {
    if (isMissingColumnError(error, "care_notify_customer_reply")) {
      return NextResponse.json(
        {
          error:
            "Notification preferences aren't available yet (migration 0204 pending). You'll keep receiving customer-reply notifications until then.",
        },
        { status: 409 }
      );
    }
    console.error("[me/care-notifications PATCH] failed to save preference:", error);
    return NextResponse.json({ error: "Couldn't save your notification preference." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, customerReply: body.customerReply });
}
