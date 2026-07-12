import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/bank/accounts/[id]/import — import parsed bank statement rows.
 * The client parses the CSV file into rows; the server validates + inserts, deduping on
 * (bank_account_id, external_id). amount is SIGNED (+ deposit / − withdrawal). Returns inserted count.
 */
const Body = z.object({
  rows: z
    .array(
      z.object({
        txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: z.number().finite(),
        description: z.string().max(500).optional(),
        externalId: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(5000),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const rows = body.rows.map((r) => ({
    company_id: companyId,
    bank_account_id: id,
    txn_date: r.txnDate,
    amount: r.amount,
    description: r.description ?? null,
    external_id: r.externalId ?? null,
    source: "csv",
    created_by: auth.user.id,
  }));
  // Dedupe on (bank_account_id, external_id): ignoreDuplicates so re-importing a statement doesn't
  // double-count rows that carry a stable external_id.
  const { data, error } = await sb
    .from("fin_bank_transactions")
    .upsert(rows, { onConflict: "bank_account_id,external_id", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[bank/import] failed:", error.message);
    return NextResponse.json({ error: "Import failed (check the bank account and your finance-enter permission)." }, { status: 400 });
  }
  return NextResponse.json({ imported: data?.length ?? 0, submitted: rows.length });
}
