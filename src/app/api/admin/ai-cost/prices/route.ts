import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * GET/POST /api/admin/ai-cost/prices — provider prices for the AI cost ledger (RSS Phase 0 step 6).
 *
 * Vendor-only. No price is seeded or hard-coded anywhere (the plan's rule: no price in code or .env). An
 * ELOSTATE admin enters each one from the provider's own price page. A change of price is a NEW row with a
 * later `effective_from`, so past days stay costed at the price that applied then (cost.ts picks the latest
 * price effective on the call's date). A second row for the same provider/model/unit/date is refused (409).
 */
const Body = z.object({
  provider: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(120),
  unit: z.enum(["input_token", "output_token", "audio_second"]),
  usdPerUnit: z.number().nonnegative().finite(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-01."),
});

export async function GET() {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  const { data, error } = await createAdminClient()
    .from("ai_prices")
    .select("provider, model, unit, usd_per_unit, effective_from")
    .order("effective_from", { ascending: false });
  if (error) {
    console.error(`[admin/ai-cost/prices] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load prices." }, { status: 500 });
  }
  return NextResponse.json({ prices: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "admin-ai-prices", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const { error } = await createAdminClient().from("ai_prices").insert({
    provider: body.provider,
    model: body.model,
    unit: body.unit,
    usd_per_unit: body.usdPerUnit,
    effective_from: body.effectiveFrom,
    entered_by: gate.userId,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A price for that model, unit and date already exists. Enter a later date to change it." }, { status: 409 });
    }
    console.error(`[admin/ai-cost/prices] insert failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the price." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
