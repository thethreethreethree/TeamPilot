import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Dunning / collections (migration 0159).
 *
 * GET  /api/finance/ar/dunning — the collections worklist: every overdue invoice with what is still owed,
 *                                how many days late, the stage the ladder says it has REACHED, and the
 *                                highest stage anyone has actually ACTIONED.
 * POST /api/finance/ar/dunning — record that a chase action was taken.
 *
 * THE TWO STAGE NUMBERS ARE THE POINT.
 * `stage_due` is what the policy says should have happened by now. `stage_actioned` is what a human
 * actually did. The gap between them is the collections backlog — the invoices where the ladder has moved
 * on and we have not. A worklist that showed only "overdue" would hide that gap; showing both makes the
 * omission itself visible, which is the only way it gets closed.
 *
 * THIS ROUTE RECORDS; IT DOES NOT SEND.
 * There is no email in this file, and that is deliberate rather than unfinished. Recording that a notice
 * was sent, when the system never sent one, would be a label promising something the write path does not
 * do — a false guarantee that reads as evidence in a dispute. Whatever actually delivers the notice calls
 * this endpoint afterwards. If you later wire a sender, it calls this; it does not replace it.
 *
 * The recorded event is APPEND-ONLY at the database (do-instead-nothing rules, which bind service-role
 * and direct SQL too, not just this route). A chase record you can quietly edit is not evidence.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ worklist: [], policies: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [wl, pol] = await Promise.all([
    sb
      .from("fin_dunning_worklist")
      .select(
        "invoice_id, invoice_number, customer_id, customer_name, due_date, currency, outstanding, days_overdue, stage_due, stage_actioned, last_action_at",
      )
      .order("days_overdue", { ascending: false }),
    // THE LADDER. Without it, stage_due is always null and the worklist is inert — an empty collections
    // page that looks perfectly healthy. The page must be able to tell the user THAT is why it is empty.
    sb
      .from("fin_dunning_policies")
      .select("id, stage, days_overdue, label, channel, is_active")
      .order("days_overdue"),
  ]);

  // An empty collections list is a claim that nobody owes us anything late. If the read actually failed,
  // that claim is false and dangerously reassuring — so it is surfaced as an error, never as [].
  if (wl.error) return NextResponse.json({ error: "Could not load the collections worklist." }, { status: 500 });
  return NextResponse.json({ worklist: wl.data ?? [], policies: pol.error ? [] : (pol.data ?? []) });
}

const RecordSchema = z
  .object({
    invoiceId: z.string().uuid(),
    stage: z.number().int().min(1).max(20),
    channel: z.enum(["email", "phone", "letter", "other"]).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

/**
 * The ESCALATION LADDER itself (0159).
 *
 * Without a ladder there is nothing to chase: fin_dunning_worklist derives `stage_due` from these rows, so
 * a company with no policies has an empty collections list FOREVER — and it looks perfectly healthy, which
 * is the worst way for a feature to fail. Nothing is seeded on the user's behalf either: a chase ladder is
 * a decision about how you speak to your customers, and inventing one would put words in your mouth.
 */
const PolicySchema = z
  .object({
    action: z.literal("policy"),
    stage: z.number().int().min(1).max(10),
    daysOverdue: z.number().int().min(0).max(365),
    label: z.string().min(1).max(80),
    channel: z.enum(["email", "phone", "letter", "other"]).default("email"),
  })
  .strict();

export async function PUT(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, PolicySchema);
  if (b instanceof NextResponse) return b;

  // RLS decides who may configure the ladder (controller/CFO). We do not re-check it here — a second,
  // weaker copy of an authz rule is how the two drift apart.
  const { error } = await sb.from("fin_dunning_policies").insert({
    stage: b.stage,
    days_overdue: b.daysOverdue,
    label: b.label.trim(),
    channel: b.channel,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const { error } = await sb.from("fin_dunning_policies").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, RecordSchema);
  if (b instanceof NextResponse) return b;

  // The RPC is SECURITY DEFINER: it verifies the invoice is ours, checks fin_can_enter(), stamps the
  // actor as auth.uid() (so the record cannot be attributed to someone else), and snapshots days_overdue
  // at the moment of the action. None of that is re-implemented here.
  const { data, error } = await sb.rpc("fin_record_dunning_action", {
    p_invoice_id: b.invoiceId,
    p_stage: b.stage,
    p_channel: b.channel ?? "email",
    p_note: b.note ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data });
}
