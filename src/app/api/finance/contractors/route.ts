import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Contractor / 1099 reporting (0170).
 *
 * GET  ?year=2026 — the filing worksheet + the blockers standing between it and a filing.
 * POST — mark a vendor as 1099-reportable (or not), and record their TIN.
 *
 * The figures here are read from views that compute CASH PAID in the calendar year from the ledger's
 * server-computed base amounts. This route does no arithmetic of its own — a second implementation of the
 * total would be a second thing to be wrong, and the wrong one would be the one on the tax form.
 */

export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ rows: [], blockers: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const url = new URL(req.url);
  // Default to the year that is actually being filed: 1099s for year Y are filed in early Y+1, so in
  // January the user almost always wants LAST year, not this one.
  const now = new Date();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const year = Number(url.searchParams.get("year") ?? defaultYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const [ws, blockers, vendors] = await Promise.all([
    sb
      .from("fin_1099_worksheet")
      .select("vendor_id, vendor_name, tax_id, tax_classification, payment_count, total_paid, meets_threshold, missing_tax_id")
      .eq("tax_year", year)
      .order("total_paid", { ascending: false }),
    sb.rpc("fin_1099_readiness", { p_year: year }),
    sb.from("fin_vendors").select("id, name, is_1099, tax_id, tax_classification").order("name"),
  ]);

  if (ws.error) return NextResponse.json({ error: "Could not load the 1099 worksheet." }, { status: 500 });

  return NextResponse.json({
    year,
    rows: ws.data ?? [],
    // If the readiness check itself failed we say so — reporting "no blockers" because the query errored
    // would tell the user their filing is clean at the exact moment we cannot see whether it is.
    blockers: blockers.error ? null : (blockers.data ?? []),
    blockersUnknown: Boolean(blockers.error),
    vendors: vendors.data ?? [],
  });
}

const Schema = z
  .object({
    vendorId: z.string().uuid(),
    is1099: z.boolean(),
    taxId: z.string().max(50).optional(),
    taxClassification: z.enum(["individual", "sole_prop", "partnership", "llc", "corp"]).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, Schema);
  if (b instanceof NextResponse) return b;

  // 1099 eligibility is a DECLARATION about a legal relationship, never an inference. We do not derive it
  // from the vendor's name, their payment pattern, or whether they look like a person — a sole trader may
  // not be reportable and a company certainly isn't. A human with authority states it, on the record.
  const patch: Record<string, unknown> = { is_1099: b.is1099 };
  if (b.taxId !== undefined) patch.tax_id = b.taxId.trim() || null;
  if (b.taxClassification !== undefined) patch.tax_classification = b.taxClassification;

  const { error } = await sb.from("fin_vendors").update(patch).eq("id", b.vendorId);
  // RLS decides who may write a vendor; its refusal is the authoritative one.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
