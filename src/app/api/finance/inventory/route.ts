import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Inventory & COGS (0180) — weighted average, perpetual (founder-confirmed).
 *
 * Every quantity and cost is computed by the database under a ROW LOCK. This route never calculates an
 * average, never decides a COGS figure, and never writes qty_on_hand. It asks; the ledger decides.
 *
 * That is not fastidiousness. Two concurrent sales of the same item would otherwise both read the same
 * quantity, both pass the stock check, and both post COGS against inventory only one of them can have. The
 * books would balance. The warehouse would be short. And the inventory asset would go NEGATIVE — a physical
 * impossibility that no report would ever think to query for.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ items: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // The default period offered for an inventory posting must be the one that CONTAINS today, because the
  // posting RPCs (0180) date the entry `current_date`. Offering an arbitrary open period (the old
  // `.eq(status,open).limit(1)` with no date filter) is a latent H1-class bug: with monthly periods, two can
  // be open at once and an unordered limit(1) could hand back June while today is July, so the today-dated
  // entry lands in the wrong period (GL views aggregate by entry_date, so it silently mis-buckets — and once
  // migration 0196's containment trigger is live, that mismatch is REJECTED). Selecting the containing period
  // is a no-op for the default single year-long period (it contains today) and correct for multi-period books.
  // `toISOString()` is UTC by spec (independent of the server's local TZ), and the DB session is UTC (verified
  // 2026-07-27 against the live DB: current_setting('TimeZone')='UTC'), so this string equals the DB's
  // `current_date` at ALL times — both roll over together at UTC midnight, no skew. (Even if that ever changed,
  // this is only the default period HINT; the posting RPC + 0196 catch a genuine date/period mismatch anyway.)
  const today = new Date().toISOString().slice(0, 10);
  const [items, check, shrink, missingCogs, periods] = await Promise.all([
    sb.from("fin_inventory_items").select("id, sku, name, qty_on_hand, avg_cost, is_active").order("sku"),
    sb.from("fin_inventory_check").select("item_id, sku, discrepancy, stated_value"),
    sb.from("fin_inventory_shrinkage").select("month, write_offs, units_lost, value_lost").order("month", { ascending: false }).limit(12),
    // 0181's backstop view. It SHOULD always be empty — an invoice that sold stock but never costed it is
    // carrying a 100% gross margin, and every profitability page in the product is reading that lie. The
    // view exists to catch anything issued before 0181, or through any path that bypassed fin_issue_invoice.
    // Before this it was queried by nothing: a safety net that was never hung. Now it is (§A31).
    sb.from("fin_invoices_missing_cogs").select("invoice_id, invoice_number, invoice_date, stock_lines"),
    sb.from("fin_periods").select("id, status").eq("status", "open").lte("start_date", today).gte("end_date", today).limit(1),
  ]);

  if (items.error) return NextResponse.json({ error: "Could not load inventory." }, { status: 500 });

  return NextResponse.json({
    items: items.data ?? [],
    // Where the item's stated quantity disagrees with its movement history. A non-zero discrepancy means
    // something wrote to the item directly, bypassing the RPCs — the movements are what actually happened.
    discrepancies: (check.data ?? []).filter((c) => Math.abs(Number(c.discrepancy ?? 0)) > 0.0001),
    shrinkage: shrink.data ?? [],
    // Invoices that sold stock without posting its cost. Empty is the healthy state; any row is a margin lie.
    missingCogs: missingCogs.data ?? [],
    openPeriodId: periods.data?.[0]?.id ?? null,
  });
}

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    sku: z.string().min(1).max(60),
    name: z.string().min(1).max(160),
  }).strict(),
  z.object({
    action: z.literal("receive"),
    itemId: z.string().uuid(),
    qty: z.number().positive(),
    unitCost: z.number().min(0),
    periodId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("sell"),
    itemId: z.string().uuid(),
    qty: z.number().positive(),
    periodId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("adjust"),
    itemId: z.string().uuid(),
    qtyDelta: z.number(),
    // A reason is REQUIRED by the schema, not merely encouraged. A write-off with no reason is the shape
    // every inventory fraud takes — it is the only thing standing between "damaged in transit" and "walked
    // out of the door".
    reason: z.string().min(3).max(200),
    periodId: z.string().uuid(),
  }).strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  if (b.action === "create") {
    const { data, error } = await sb
      .from("fin_inventory_items")
      .insert({ sku: b.sku.trim(), name: b.name.trim() })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ id: data.id });
  }

  const rpc =
    b.action === "receive" ? "fin_receive_inventory"
    : b.action === "sell" ? "fin_sell_inventory"
    : "fin_adjust_inventory";

  const args =
    b.action === "receive"
      ? { p_item: b.itemId, p_qty: b.qty, p_unit_cost: b.unitCost, p_period: b.periodId }
      : b.action === "sell"
      ? { p_item: b.itemId, p_qty: b.qty, p_period: b.periodId }
      : { p_item: b.itemId, p_qty_delta: b.qtyDelta, p_period: b.periodId, p_reason: b.reason };

  const { data, error } = await sb.rpc(rpc, args);
  // The database's refusal is the true one — including "only 6 are on hand, you cannot sell 10". We do not
  // soften it, and we never fall back to posting the sale anyway.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ entryId: data });
}
