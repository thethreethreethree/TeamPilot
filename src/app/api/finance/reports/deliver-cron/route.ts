import { NextRequest, NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/notifications/sender";

/**
 * GET /api/finance/reports/deliver-cron — the scheduled-report delivery worker (0172).
 *
 * Mirrors the durability / task-overrun cron precedent (same CRON_SECRET, same 503-when-unset, same
 * constant-time compare).
 *
 * TO ACTIVATE (operator step, deliberately the founder's):
 *   1. CRON_SECRET in Vercel env (shared with the existing crons).
 *   2. vercel.json: { "path": "/api/finance/reports/deliver-cron", "schedule": "0 7 * * *" }
 * Until both are done this 503s and nothing invokes it. Dormant and safe.
 *
 * ── WHY THIS WORKER IS ALLOWED THE ADMIN CLIENT, AND WHY IT IS STILL NEARLY POWERLESS ────────
 *
 * There is no logged-in user at 7am, so it must run as the service role. That is exactly why it is written
 * to decide as little as possible:
 *
 * IT DOES NOT DECIDE WHO MAY RECEIVE ANYTHING. It reads fin_report_schedules_due — a view that has ALREADY
 * re-checked, at this moment rather than at setup time, that the recipient is still in the company, still
 * active, and still holds finance access. A recipient who left in June is simply not in the list.
 *
 * So this worker cannot deliver a company's ledger to a former employee even if this file were badly
 * wrong: THE DATABASE NEVER HANDS IT THE ADDRESS. Had the authority check lived here instead, it would sit
 * one careless `if` away from a recurring leak nobody would ever notice — from the inside, everything would
 * look exactly as configured.
 *
 * WHAT IT DELIVERS: a notification that the report is ready, with a link — NOT the figures themselves.
 * A push payload is stored by the browser's push service and shown on a lock screen; putting a company's
 * revenue in it would leak the number to anyone glancing at the phone, and to a subscription endpoint we
 * do not control. The numbers stay behind the login. The notification is a doorbell, not an envelope.
 */
// Report delivery generates + emails scheduled reports — the most likely of the crons to exceed the
// ~10s Vercel default. 60s is the proven-safe ceiling here (backfill-dissects-cron uses it; main
// deploys). Only relevant once CRON_SECRET activates the cron. (If delivery ever needs >60s, batch it.)
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set. Scheduled report delivery is disabled until you configure it." },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sb = createAdminClient();

  // The due list has already answered "may this person see this TODAY?". We neither re-derive it nor widen
  // it — we only read it.
  const { data: due, error } = await sb
    .from("fin_report_schedules_due")
    .select("schedule_id, company_id, report_id, recipient_id, report_name");

  if (error) {
    return NextResponse.json({ error: `Could not read the due list: ${error.message}` }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const d of due ?? []) {
    try {
      const res = await sendPushToUsers({
        userIds: [d.recipient_id],
        payload: {
          title: d.report_name,
          // No figures. A doorbell, not an envelope — see the header.
          body: "Your scheduled report is ready.",
          url: "/dashboard/finance/reports",
          // Per-schedule tag: a monthly report replaces last month's notification rather than stacking a
          // year of identical unread badges, which is how a person stops reading them at all.
          tag: `fin-report-${d.schedule_id}`,
        },
      });
      if (res.sent === 0) throw new Error("No active push subscription for this recipient.");

      await sb.rpc("fin_record_report_delivery", { p_schedule: d.schedule_id, p_status: "sent" });
      sent++;
    } catch (e) {
      // A failure is RECORDED, never swallowed. A delivery that silently stops is worse than one that never
      // existed: the recipient believes no news is good news, and quietly stops looking at the numbers they
      // were relying on. fin_report_delivery_failures is where this surfaces.
      failed++;
      await sb.rpc("fin_record_report_delivery", {
        p_schedule: d.schedule_id,
        p_status: "failed",
        p_detail: e instanceof Error ? e.message.slice(0, 500) : "Unknown error",
      });
    }
  }

  return NextResponse.json({ due: (due ?? []).length, sent, failed });
}
