import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * Payroll runs (migration 0167) — record what a provider computed, post it to the ledger.
 *
 * THIS API HAS NO GROSS-TO-NET CALCULATOR, AND THAT IS THE FEATURE.
 * Statutory withholding tables change by jurisdiction and by year, and getting them wrong is not a bug —
 * it is a liability with a penalty attached. The provider (Gusto / Deel / a bureau) computes; we record
 * and post. Any endpoint here that started calculating tax would be quietly taking on that liability.
 *
 * TWO THINGS THIS ROUTE IS CAREFUL ABOUT:
 *
 * 1. It asks for gross, net, withholdings and employer cost SEPARATELY, and it refuses a run where
 *    gross ≠ net + withholdings. The temptation is to "helpfully" derive one from the others — e.g.
 *    compute withholdings as gross − net. Do not. If the provider's figures disagree, that disagreement
 *    is INFORMATION: a column was misread, a figure truncated, a currency mixed. Deriving the missing
 *    number would paper over a real import error and post a balanced, wrong entry.
 *
 * 2. Employer tax is a SEPARATE field from gross, never rolled in. Folding it into gross would still
 *    balance, still tie out — and would make the true cost of an employee indistinguishable from their
 *    salary, silently corrupting every cost-per-project and unit-economics figure downstream.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ runs: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_payroll_runs")
    .select(
      "id, provider, external_id, period_start, period_end, pay_date, gross, withholdings, net_pay, employer_tax, benefits, headcount, status, posted_entry_id",
    )
    .order("pay_date", { ascending: false });

  if (error) return NextResponse.json({ error: "Could not load payroll runs." }, { status: 500 });
  return NextResponse.json({ runs: data ?? [] });
}

const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("record"),
      provider: z.string().max(40).optional(),
      externalId: z.string().max(120).optional(),
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      gross: z.number().positive().finite(),
      netPay: z.number().positive().finite(),
      withholdings: z.number().nonnegative().finite(),
      employerTax: z.number().nonnegative().finite().optional(),
      benefits: z.number().nonnegative().finite().optional(),
      headcount: z.number().int().positive().optional(),
      costCenterId: z.string().uuid().optional(),
    })
    .strict()
    // The identity, mirrored from the DB CHECK — and NOT silently repaired. A mismatch means the import
    // is wrong, and saying so is more useful than posting a balanced entry built on a misread column.
    // Tolerance is a hundredth of a cent, so genuine rounding from a provider does not trip it.
    .refine((v) => Math.abs(v.gross - (v.netPay + v.withholdings)) < 0.005, {
      message:
        "These figures don't add up: gross must equal net pay + withholdings. Check the columns from your provider — a mismatch usually means one was misread.",
    }),
  z
    .object({
      action: z.literal("post"),
      runId: z.string().uuid(),
      periodId: z.string().uuid(),
    })
    .strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  if (b.action === "record") {
    const { data, error } = await sb
      .from("fin_payroll_runs")
      .insert({
        company_id: companyId,
        provider: b.provider ?? "manual",
        external_id: b.externalId ?? null,
        period_start: b.periodStart,
        period_end: b.periodEnd,
        pay_date: b.payDate,
        gross: b.gross,
        net_pay: b.netPay,
        withholdings: b.withholdings,
        employer_tax: b.employerTax ?? 0,
        benefits: b.benefits ?? 0,
        headcount: b.headcount ?? null,
        cost_center_id: b.costCenterId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // A unique violation here is the re-import guard doing its job — a provider webhook firing twice.
      // Say that, rather than a generic failure the user would retry into.
      const dup = error.code === "23505";
      return NextResponse.json(
        {
          error: dup
            ? "This payroll run has already been recorded (same provider run id). Re-importing it would post a second month of salary expense."
            : error.message,
        },
        { status: dup ? 409 : 403 },
      );
    }
    if (!data) return NextResponse.json({ error: "Payroll run not saved." }, { status: 403 });
    return NextResponse.json({ id: data.id });
  }

  const { data, error } = await sb.rpc("fin_post_payroll_run", {
    p_run_id: b.runId,
    p_period_id: b.periodId,
  });

  // The RPC's message is the useful one. If the identity is violated it names the three figures — which
  // is exactly what an accountant staring at a payroll run needs. A generic "couldn't post" would be a
  // failure of the feature, not of the user.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ entryId: data });
}
