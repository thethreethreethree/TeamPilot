import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Opening balances (0169) — carrying the old books in.
 *
 * GET  — the batches, their summary (INCLUDING the imbalance), and whether OBE still carries a balance.
 * POST — stage a trial balance · post it.
 *
 * THE IMBALANCE IS NOT AN ERROR THIS ROUTE HANDLES. IT IS A FACT THIS ROUTE REPORTS.
 *
 * A trial balance from a real company's old system frequently does not balance. The instinct of every API
 * ever written is to reject the malformed input — 400, "debits must equal credits", come back when it's
 * clean. That would be the wrong call here, and expensively so: the user would go and *make* it balance in
 * a spreadsheet before re-uploading, and the discrepancy — the one genuinely valuable thing the import had
 * to tell them — would be erased by hand, off the record, forever.
 *
 * So we ACCEPT the imbalanced trial balance, and we tell them exactly how far out it is. The database posts
 * the residual to Opening Balance Equity, where it stays visible until a human resolves it. The system's
 * job here is not to demand clean data; it is to refuse to pretend the data is clean.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ batches: [], imbalance: null });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [batches, summary, imb] = await Promise.all([
    sb
      .from("fin_opening_batches")
      .select("id, as_of, source, status, entry_id, posted_at, created_at")
      .order("created_at", { ascending: false }),
    sb.from("fin_opening_summary").select("batch_id, line_count, total_debits, total_credits, imbalance"),
    sb.from("fin_opening_imbalance").select("obe_balance").maybeSingle(),
  ]);

  if (batches.error || summary.error) {
    return NextResponse.json({ error: "Could not load opening balances." }, { status: 500 });
  }

  const byId = new Map((summary.data ?? []).map((s) => [s.batch_id, s]));
  return NextResponse.json({
    batches: (batches.data ?? []).map((b) => ({ ...b, summary: byId.get(b.id) ?? null })),
    // Non-null and non-zero means: your old books did not balance, and nobody has reconciled it yet.
    // A read failure here is reported as null (unknown), never as 0 (all clear) — see below.
    imbalance: imb.error ? null : (imb.data?.obe_balance ?? 0),
    imbalanceUnknown: Boolean(imb.error),
  });
}

const Line = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
});

const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("stage"),
      asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      source: z.string().max(200).optional(),
      // NOTE: there is no check here that debits equal credits. That is deliberate — see the header.
      lines: z.array(Line).min(1).max(2000),
    })
    .strict()
    .refine(
      (v) => v.lines.every((l) => (l.debit > 0 && l.credit === 0) || (l.credit > 0 && l.debit === 0)),
      { message: "Each line must be either a debit or a credit — never both, and never neither." },
    ),
  z.object({ action: z.literal("post"), batchId: z.string().uuid(), periodId: z.string().uuid() }).strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  if (b.action === "stage") {
    const { data: batch, error: be } = await sb
      .from("fin_opening_batches")
      .insert({ as_of: b.asOf, source: b.source ?? null })
      .select("id")
      .single();
    // RLS refuses this for anyone below controller — the message is the database's, and it is the true one.
    if (be || !batch) return NextResponse.json({ error: be?.message ?? "Could not stage." }, { status: 403 });

    const { error: le } = await sb.from("fin_opening_lines").insert(
      b.lines.map((l) => ({ batch_id: batch.id, account_id: l.accountId, debit: l.debit, credit: l.credit })),
    );
    if (le) {
      // The batch exists but its lines do not. Leaving a half-staged batch behind would show the user an
      // empty trial balance that looks like a completed import of nothing.
      await sb.from("fin_opening_batches").delete().eq("id", batch.id);
      return NextResponse.json({ error: le.message }, { status: 400 });
    }
    return NextResponse.json({ batchId: batch.id });
  }

  const { data, error } = await sb.rpc("fin_post_opening_batch", {
    p_batch: b.batchId,
    p_period: b.periodId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ entryId: data });
}
