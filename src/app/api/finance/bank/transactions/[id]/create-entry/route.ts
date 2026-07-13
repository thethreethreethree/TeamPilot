import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/bank/transactions/[id]/create-entry
 *
 * The bank knows about this money; the ledger does not. Create the missing journal entry, post it, and
 * match it to the bank line — in one transaction (migration 0163).
 *
 * This closes the reconciliation escape hatch. Before it, a clerk facing an unexplained bank line (a fee,
 * interest, an FX charge) could only match it to something it wasn't, or IGNORE it. Ignoring is the
 * dangerous option: the line leaves the worklist, the ledger stays wrong, and cash disagrees with the bank
 * by exactly that amount forever — while the reconciliation reports itself as done.
 *
 * THE CALLER SENDS ONE ACCOUNT, NOT A DIRECTION.
 * Notice what this route does NOT accept: no debit/credit, no sign, no "which side". The clerk says what
 * the money was FOR; the database derives the direction from the bank line's own sign. That is deliberate.
 * A reconciliation entry posted backwards still BALANCES — so the balance assertion, the trial balance and
 * the statements would all happily agree with a bank fee booked as income. There is no downstream check
 * that would catch it. The only reliable defence is to never let a human choose the direction, so the API
 * gives them no way to express one.
 */

const Schema = z
  .object({
    accountId: z.string().uuid(),
    description: z.string().max(200).optional(),
  })
  .strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id: txnId } = await ctx.params;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, Schema);
  if (b instanceof NextResponse) return b;

  // The RPC is SECURITY DEFINER: it locks the bank line, checks fin_can_enter(), verifies the line AND
  // the chosen account belong to the caller's company, refuses the bank's own cash account as the other
  // side, requires an open period, and posts through the shared subledger path. None of that is
  // re-implemented here — a second, weaker copy of those checks in this file is how the two drift apart.
  const { data, error } = await sb.rpc("fin_reconcile_create_entry", {
    p_txn_id: txnId,
    p_account_id: b.accountId,
    p_description: b.description ?? null,
  });

  if (error) {
    // Surface the database's own message. It names the real obstacle — "no OPEN period covers that date",
    // "the other side cannot be the bank's own cash account" — and replacing it with generic wording would
    // throw away the only fact the clerk needs to act on.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // The entry id: the bank line is now explained BY the entry it created, and that entry is traceable
  // from the reconciliation match back to this line.
  return NextResponse.json({ entryId: data });
}
