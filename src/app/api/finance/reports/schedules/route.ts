import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Scheduled report delivery (0172).
 *
 * GET  — the schedules, and any deliveries that FAILED.
 * POST — schedule · pause/resume · delete.
 *
 * THIS ROUTE ACCEPTS NO EMAIL ADDRESS. A schedule is addressed to a `recipientId` — a member of the
 * company — and never to a free-text address. That is not a UX simplification; it is the security model.
 * An `email` field here would turn a report subscription into a recurring exfiltration channel for the
 * company's financials, complete with an audit trail that looks entirely routine.
 *
 * RLS additionally requires the recipient to already hold finance access, so subscribing someone cannot be
 * a back door to showing them the ledger.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ schedules: [], failures: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [sched, fails] = await Promise.all([
    sb
      .from("fin_report_schedules")
      .select("id, report_id, recipient_id, cadence, next_run_on, is_active")
      .order("next_run_on"),
    sb
      .from("fin_report_delivery_failures")
      .select("schedule_id, report_name, recipient_id, ran_at, status, detail")
      .limit(20),
  ]);

  if (sched.error) return NextResponse.json({ error: "Could not load schedules." }, { status: 500 });
  return NextResponse.json({
    schedules: sched.data ?? [],
    // A failed delivery that nobody sees is the failure mode this whole feature has to avoid. If we cannot
    // read the failure list, we say so rather than rendering an empty (reassuring) one.
    failures: fails.error ? null : (fails.data ?? []),
    failuresUnknown: Boolean(fails.error),
  });
}

const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("schedule"),
      reportId: z.string().uuid(),
      // A member. NOT an email address — see the header. This field's TYPE is the control.
      recipientId: z.string().uuid(),
      cadence: z.enum(["weekly", "monthly", "quarterly"]),
      nextRunOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict(),
  z.object({ action: z.literal("pause"), id: z.string().uuid(), active: z.boolean() }).strict(),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }).strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  if (b.action === "schedule") {
    const { data, error } = await sb
      .from("fin_report_schedules")
      .insert({
        report_id: b.reportId,
        recipient_id: b.recipientId,
        cadence: b.cadence,
        next_run_on: b.nextRunOn,
      })
      .select("id")
      .single();
    // RLS refuses if the recipient is not a member with finance access. Its message is the true one.
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ id: data.id });
  }

  if (b.action === "pause") {
    // Only is_active moves. recipient_id and report_id are frozen by trigger, so even if this route were
    // one day extended carelessly, an existing schedule could not be silently re-pointed at someone else
    // and inherit its already-granted legitimacy.
    const { error } = await sb
      .from("fin_report_schedules")
      .update({ is_active: b.active })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await sb.from("fin_report_schedules").delete().eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
