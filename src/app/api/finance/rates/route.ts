import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * Mileage + per-diem rate configuration (migration 0161).
 *
 * GET  /api/finance/rates — the company's effective-dated rate history (both kinds).
 * POST /api/finance/rates — add a rate, effective from a date. Controller/CFO only.
 *
 * WHY THIS SURFACE EXISTS AT ALL — and why it is the FIRST thing built for Phase 2:
 * 0161 derives a mileage/per-diem claim's money server-side as round(rate * quantity, 4), and it RAISES
 * if no rate is configured for the expense date. That is deliberate — silently valuing an unrated claim
 * at zero would be worse. But it means that until a rate exists, the very first employee to claim mileage
 * gets an error. So this config surface is not polish; it is the precondition for the feature to function.
 *
 * A rate is NEVER edited in place — a new effective_from row supersedes it. That is not a UI convention,
 * it is what keeps history honest: editing March's rate would silently revalue every January claim that
 * was already approved and posted. The DB resolves the rate as of the EXPENSE DATE, so the old row must
 * survive. (Same reason the ledger corrects by reversal rather than by editing.)
 *
 * Authorization is NOT enforced here — it is enforced by RLS (fin_can_configure() = controller/cfo) and,
 * for the derivation itself, by a DB trigger. This route uses the RLS client precisely so that a request
 * from an ordinary employee is rejected by the database, not by a check in this file that a direct
 * PostgREST call could bypass.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ mileage: [], perDiem: [], fx: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [mileage, perDiem, fx] = await Promise.all([
    sb
      .from("fin_mileage_rates")
      .select("id, effective_from, rate_per_unit, unit, currency, note")
      .order("effective_from", { ascending: false }),
    sb
      .from("fin_per_diem_rates")
      .select("id, effective_from, jurisdiction, daily_rate, currency, note")
      .order("effective_from", { ascending: false }),
    sb
      .from("fin_exchange_rates")
      .select("id, from_currency, to_currency, rate, as_of_date")
      .order("as_of_date", { ascending: false })
      .limit(50),
  ]);

  // Distinguish a real failure from an honestly-empty list: returning [] on an error would tell the
  // controller "no rates are configured" when the truth is "we could not read them" — and they would
  // then add a duplicate rate. Surface the error instead.
  if (mileage.error || perDiem.error) {
    return NextResponse.json({ error: "Could not load rates." }, { status: 500 });
  }

  return NextResponse.json({ mileage: mileage.data ?? [], perDiem: perDiem.data ?? [], fx: fx.error ? [] : (fx.data ?? []) });
}

const MileageSchema = z
  .object({
    kind: z.literal("mileage"),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ratePerUnit: z.number().nonnegative().finite(),
    unit: z.enum(["km", "mi"]).optional(),
    currency: z.string().length(3).optional(),
    note: z.string().max(300).optional(),
  })
  .strict();

const PerDiemSchema = z
  .object({
    kind: z.literal("per_diem"),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dailyRate: z.number().nonnegative().finite(),
    jurisdiction: z.string().min(1).max(40).optional(),
    currency: z.string().length(3).optional(),
    note: z.string().max(300).optional(),
  })
  .strict();

/**
 * EXCHANGE RATES (0119). The founder's confirmed build parameter was "manual FX now, API-ready" — and
 * until this route existed, there was NO WAY TO ENTER A RATE AT ALL. A foreign-currency invoice would have
 * been converted at whatever fin_get_rate falls back to, silently, and every base-currency figure derived
 * from it would have been wrong by the size of the FX move. The books would still balance.
 */
const FxSchema = z
  .object({
    kind: z.literal("fx"),
    fromCurrency: z.string().length(3),
    toCurrency: z.string().length(3),
    rate: z.number().positive(),
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .refine((v) => v.fromCurrency.toUpperCase() !== v.toCurrency.toUpperCase(), {
    message: "A currency cannot have an exchange rate against itself.",
  });

const CreateSchema = z.discriminatedUnion("kind", [MileageSchema, PerDiemSchema, FxSchema]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  const b = await readBody(req, CreateSchema);
  if (b instanceof NextResponse) return b;

  if (b.kind === "fx") {
    // Effective-dated, like every other rate here: a rate entered today does not revalue yesterday's
    // invoice. Re-pricing history because the pound moved would rewrite what a transaction was worth on
    // the day it happened.
    const { error } = await sb.from("fin_exchange_rates").insert({
      from_currency: b.fromCurrency.toUpperCase(),
      to_currency: b.toCurrency.toUpperCase(),
      rate: b.rate,
      as_of_date: b.asOfDate,
    });
    if (error) {
      // CWE-209: never hand the raw PostgREST/Postgres error to the client — an RLS denial or a
      // constraint failure would leak table/column/policy names. Log it server-side, return a generic
      // message. Rate-setting is controller/CFO-gated, so the likely cause is a permission denial.
      console.error("[finance/rates POST] rate insert failed:", error);
      return NextResponse.json(
        { error: "Couldn't save the rate — you may not have permission to set rates." },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (b.kind === "mileage") {
    const { data, error } = await sb
      .from("fin_mileage_rates")
      .insert({
        company_id: companyId,
        effective_from: b.effectiveFrom,
        rate_per_unit: b.ratePerUnit,
        unit: b.unit ?? "km",
        currency: b.currency ?? "EUR",
        note: b.note ?? null,
      })
      .select("id")
      .maybeSingle();

    // An RLS denial comes back as an error (or as no row) — never report a phantom ok. An employee
    // hitting this route must SEE that they were refused, not believe a rate was saved.
    if (error) {
      // CWE-209: never hand the raw PostgREST/Postgres error to the client — an RLS denial or a
      // constraint failure would leak table/column/policy names. Log it server-side, return a generic
      // message. Rate-setting is controller/CFO-gated, so the likely cause is a permission denial.
      console.error("[finance/rates POST] rate insert failed:", error);
      return NextResponse.json(
        { error: "Couldn't save the rate — you may not have permission to set rates." },
        { status: 403 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Rate not saved — only a controller or CFO may set rates." },
        { status: 403 },
      );
    }
    return NextResponse.json({ id: data.id });
  }

  const { data, error } = await sb
    .from("fin_per_diem_rates")
    .insert({
      company_id: companyId,
      effective_from: b.effectiveFrom,
      jurisdiction: b.jurisdiction ?? "default",
      daily_rate: b.dailyRate,
      currency: b.currency ?? "EUR",
      note: b.note ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!data) {
    return NextResponse.json(
      { error: "Rate not saved — only a controller or CFO may set rates." },
      { status: 403 },
    );
  }
  return NextResponse.json({ id: data.id });
}
