import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * PATCH /api/finance/bank/transactions/[id] — reconcile one bank line.
 *  { action: "ignore" }                 → mark it ignored (not a ledger event; RLS update).
 *  { action: "match", entryId: uuid }   → link it to a posted GL entry (fin_match_bank_txn, DEFINER).
 */
const Body = z.union([
  z.object({ action: z.literal("ignore") }),
  z.object({ action: z.literal("match"), entryId: z.string().uuid() }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  if (body.action === "ignore") {
    const { data, error } = await sb
      .from("fin_bank_transactions")
      .update({ status: "ignored" })
      .eq("id", id)
      .eq("status", "unmatched") // don't un-match a reconciled line
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data || data.length === 0) return NextResponse.json({ error: "Couldn't ignore (already matched, or no permission)." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // match
  const { error } = await sb.rpc("fin_match_bank_txn", { p_txn_id: id, p_entry_id: body.entryId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
