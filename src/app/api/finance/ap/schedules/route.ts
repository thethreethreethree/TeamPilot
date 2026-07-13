import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Payment scheduling (migration 0158).
 *
 * GET  /api/finance/ap/schedules  — the AP clerk's worklist: what is scheduled, what is DUE, and what is
 *                                   still actually outstanding on the underlying bill.
 * POST /api/finance/ap/schedules  — schedule / execute / cancel.
 *
 * WHY `outstanding` IS RETURNED ALONGSIDE THE SCHEDULED AMOUNT
 * A schedule is an INTENT to pay, formed at some point in the past. Between then and today the bill may
 * have been partly settled another way. Showing the scheduled amount alone would invite a clerk to pay a
 * bill twice — the DB would reject the second payment (fin_pay_bill's cumulative over-pay guard), but the
 * clerk would only discover that at the moment of failure. Showing the live outstanding balance next to
 * the intent means the discrepancy is visible BEFORE they act. The guard is the safety net; the view is
 * the thing that stops them needing it.
 *
 * This route does NOT move money. Execution calls fin_execute_payment_schedule, which delegates to the
 * existing fin_pay_bill — one posting path to the GL, not a second idiom. Actually moving funds is a
 * processor/bank concern (the spec's own build-vs-buy call); the ledger records that a payment happened.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ schedules: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_payments_due")
    .select(
      "id, bill_id, scheduled_date, amount, status, cash_code, note, bill_number, vendor_name, currency, outstanding, is_due",
    )
    .order("scheduled_date");

  // "Nothing is scheduled" and "we could not read the schedule" are different facts. Only one of them is
  // safe for an AP clerk to act on, so a read failure is surfaced, not flattened to an empty worklist.
  if (error) return NextResponse.json({ error: "Could not load payment schedules." }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [] });
}

const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("schedule"),
      billId: z.string().uuid(),
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number().positive().finite(),
      cashCode: z.string().max(20).optional(),
      note: z.string().max(300).optional(),
    })
    .strict(),
  z.object({ action: z.literal("execute"), scheduleId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("cancel"), scheduleId: z.string().uuid() }).strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  // Every branch goes through a SECURITY DEFINER RPC that does its own company + capability check and
  // takes the row locks. We do not re-implement any of that here — the guards that stop a double payment
  // live where they cannot be bypassed, and a weaker copy in this file would only drift from them.
  if (b.action === "schedule") {
    const { data, error } = await sb.rpc("fin_schedule_payment", {
      p_bill_id: b.billId,
      p_scheduled_date: b.scheduledDate,
      p_amount: b.amount,
      p_cash_code: b.cashCode ?? "1000",
      p_note: b.note ?? null,
    });
    // The RPC raises on over-scheduling (paid + already-scheduled + this > bill total). Surface that
    // message: it tells the clerk exactly how much room is actually left, which is the useful fact.
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ id: data });
  }

  if (b.action === "execute") {
    const { data, error } = await sb.rpc("fin_execute_payment_schedule", {
      p_schedule_id: b.scheduleId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // Returns the payment id — the schedule is now traceable to the GL entry it produced.
    return NextResponse.json({ paymentId: data });
  }

  const { error } = await sb.rpc("fin_cancel_payment_schedule", { p_schedule_id: b.scheduleId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
