import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * Corporate cards (migration 0160).
 *
 * GET  /api/finance/cards — every card with its position: how many imported charges are still
 *                           UNMATCHED, and what they total.
 * POST /api/finance/cards — register a card. Controller/CFO only (enforced by RLS).
 *
 * THE NUMBER THAT MATTERS HERE IS `unmatched_total`.
 * A bank reconciliation asks "did this ledger entry clear the bank?". A CARD reconciliation asks a
 * different and more uncomfortable question: "is this charge on the company's card backed by a claim
 * anyone actually submitted?" An unmatched card line is spend that nobody has accounted for. That is the
 * control this whole feature exists to give you, so it is the figure this endpoint leads with — not a
 * count of cards, and not a tidy "all reconciled" summary that hides the residue.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ cards: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_card_positions")
    .select(
      "card_id, label, last4, provider, currency, is_active, holder_id, unmatched_count, unmatched_total, imported_total",
    )
    .order("label");

  // Never flatten a read failure to an empty list: "no cards" and "we could not read your cards" are
  // different facts, and only one of them is safe to act on.
  if (error) return NextResponse.json({ error: "Could not load cards." }, { status: 500 });
  return NextResponse.json({ cards: data ?? [] });
}

const CreateSchema = z
  .object({
    label: z.string().min(1).max(120),
    last4: z
      .string()
      .regex(/^\d{4}$/, "last4 must be exactly four digits")
      .optional(),
    provider: z.string().max(60).optional(),
    currency: z.string().length(3).optional(),
    holderId: z.string().uuid().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  const b = await readBody(req, CreateSchema);
  if (b instanceof NextResponse) return b;

  const { data, error } = await sb
    .from("fin_corporate_cards")
    .insert({
      company_id: companyId,
      label: b.label,
      last4: b.last4 ?? null,
      provider: b.provider ?? null,
      currency: b.currency ?? "EUR",
      holder_id: b.holderId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!data) {
    return NextResponse.json(
      { error: "Card not saved — only a controller or CFO may register a card." },
      { status: 403 },
    );
  }
  return NextResponse.json({ id: data.id });
}
