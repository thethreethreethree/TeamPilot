import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * POST /api/finance/cards/[id]/automatch — reconcile imported card charges against expense claims.
 *
 * Calls fin_auto_match_card (0160), which matches ONLY when there is exactly ONE unmatched expense item
 * of the same amount within ±3 days. If two claims could explain one charge, it deliberately does NOT
 * guess — the charge stays unmatched for a human.
 *
 * That conservatism is the point (§A25: a false MATCH is strictly worse than a miss). A miss leaves a
 * charge visibly unaccounted-for, which is a question someone will answer. A wrong match marks the charge
 * as substantiated by the wrong claim — the charge disappears from the worklist, the real claim is
 * consumed, and the unsubstantiated-spend control fails SILENTLY, which is the one failure mode this
 * feature exists to prevent.
 *
 * The route returns how many were matched, so the caller can tell "matched 12" from "matched 0" — the
 * latter is a real answer (nothing lined up), not an error.
 */

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id: cardId } = await ctx.params;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // The RPC is SECURITY DEFINER and does its own company + capability check (fin_can_enter), so we do not
  // re-implement authorization here — a second, weaker copy of an authz rule is how the two drift apart.
  const { data, error } = await sb.rpc("fin_auto_match_card", { p_card_id: cardId });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ matched: data ?? 0 });
}
