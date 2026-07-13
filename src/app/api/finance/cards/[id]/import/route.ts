import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { parseCsv } from "@/lib/finance/bankCsv";

/**
 * POST /api/finance/cards/[id]/import — import a corporate-card statement (CSV).
 *
 * §A13 — AUTHOR THE SPACE ONCE. This deliberately reuses `parseCsv` from bankCsv.ts rather than writing a
 * second statement parser. That parser is not naive: it strips the Excel BOM, understands parenthesized
 * and trailing-minus negatives (the accounting notations a bare Number() rejects, which would otherwise
 * silently DROP every withdrawal), disambiguates MM/DD from DD/MM by the >12 signal, and handles separate
 * Debit/Credit columns. Every one of those was a real defect fixed against real statements. A card
 * statement is the same artefact from a different issuer; writing a fresh parser here would re-introduce
 * the whole class and let the two drift apart.
 *
 * §A25 — a partial import must be VISIBLE. `skipped` is returned and surfaced, never swallowed: a row we
 * could not read is a charge we did not import, and on a financial file "we imported most of it" is not a
 * safe thing to leave silent.
 *
 * Dedupe is the DB's job: fin_card_transactions has unique (card_id, external_id), so re-importing the
 * same statement cannot double-count. We upsert with ignoreDuplicates rather than pre-checking, because a
 * pre-check would race with a concurrent import.
 */

const ImportSchema = z.object({ csv: z.string().min(1).max(2_000_000) }).strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id: cardId } = await ctx.params;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  const b = await readBody(req, ImportSchema);
  if (b instanceof NextResponse) return b;

  // Confirm the card is ours BEFORE parsing. RLS would block the insert anyway, but failing early gives
  // an honest 404 instead of an import that silently writes nothing.
  const { data: card, error: cardErr } = await sb
    .from("fin_corporate_cards")
    .select("id")
    .eq("id", cardId)
    .maybeSingle();
  if (cardErr) return NextResponse.json({ error: "Could not load the card." }, { status: 500 });
  if (!card) return NextResponse.json({ error: "Card not found in your company." }, { status: 404 });

  const { rows, skipped } = parseCsv(b.csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No readable rows in that file.", imported: 0, skipped },
      { status: 400 },
    );
  }

  const payload = rows.map((r) => ({
    company_id: companyId,
    card_id: cardId,
    txn_date: r.txnDate,
    amount: r.amount,
    description: r.description ?? null,
    merchant: r.description ?? null,
    external_id: r.externalId ?? null,
  }));

  // ignoreDuplicates: the unique (card_id, external_id) is the dedupe contract. Re-importing the same
  // statement is a no-op rather than a double-count — and rows WITHOUT an external_id are still inserted,
  // which is honest: we cannot prove they are duplicates, and dropping a real charge is worse than
  // surfacing a possible repeat for a human to ignore.
  const { data, error } = await sb
    .from("fin_card_transactions")
    .upsert(payload, { onConflict: "card_id,external_id", ignoreDuplicates: true })
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  const imported = data?.length ?? 0;
  return NextResponse.json({
    imported,
    // A row present in the file but not imported was either a duplicate (already on file) or unreadable.
    // Both are reported — an import that quietly loses charges is exactly the failure this control exists
    // to prevent.
    duplicates: rows.length - imported,
    skipped,
  });
}
