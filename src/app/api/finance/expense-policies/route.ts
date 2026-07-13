import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * Expense policy configuration (migration 0162).
 *
 * GET  /api/finance/expense-policies — the company's policies (effective-dated).
 * POST /api/finance/expense-policies — add a policy. Controller/CFO only (enforced by RLS, not here).
 *
 * WHAT THIS ROUTE IS *NOT*
 * It is not where the policy is enforced. Enforcement lives in a DB trigger on the expense line, so it
 * binds every write path — this route, a future importer, service-role, direct SQL. If enforcement lived
 * here, a direct PostgREST insert would walk straight past the cap and the policy would be a promise the
 * system does not keep. This route only lets a controller DECLARE the policy.
 *
 * A policy is never edited in place — a new effective_from row supersedes it. Editing would retroactively
 * re-judge claims that were legitimate when they were made; the DB resolves the policy as of the EXPENSE
 * DATE, so the superseded row must survive.
 *
 * A policy binds to an ACCOUNT (precise) and/or a CATEGORY string (loose); at least one is required, and
 * the most specific one wins at enforcement time.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ policies: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_expense_policies")
    .select(
      "id, account_id, category, effective_from, is_disallowed, max_amount, requires_receipt_above, note, is_active",
    )
    .order("effective_from", { ascending: false });

  // A read failure must not masquerade as "no policies configured" — that would tell a controller the
  // company is unpoliced when it may be fully policed, and invite a duplicate policy.
  if (error) return NextResponse.json({ error: "Could not load expense policies." }, { status: 500 });
  return NextResponse.json({ policies: data ?? [] });
}

const CreateSchema = z
  .object({
    accountId: z.string().uuid().optional(),
    category: z.string().min(1).max(60).optional(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    isDisallowed: z.boolean().optional(),
    maxAmount: z.number().nonnegative().finite().optional(),
    requiresReceiptAbove: z.number().nonnegative().finite().optional(),
    note: z.string().max(300).optional(),
  })
  .strict()
  // Mirrors the DB's own constraint (fin_exp_policy_target_ck): a policy that binds to nothing would
  // silently never fire — the worst outcome, because the controller would believe a control exists.
  .refine((v) => v.accountId != null || v.category != null, {
    message: "A policy must bind to an account or a category — one that binds to neither never fires.",
  })
  // A policy that declares no rule is also a false comfort: it appears in the list and enforces nothing.
  .refine(
    (v) => v.isDisallowed === true || v.maxAmount != null || v.requiresReceiptAbove != null,
    { message: "A policy must state at least one rule: disallowed, a cap, or a receipt threshold." },
  );

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
    .from("fin_expense_policies")
    .insert({
      company_id: companyId,
      account_id: b.accountId ?? null,
      category: b.category ?? null,
      effective_from: b.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      is_disallowed: b.isDisallowed ?? false,
      max_amount: b.maxAmount ?? null,
      requires_receipt_above: b.requiresReceiptAbove ?? null,
      note: b.note ?? null,
    })
    .select("id")
    .maybeSingle();

  // RLS denial must be VISIBLE. Returning ok on a blocked write is the false-ok class: the controller
  // would believe the cap is live when nothing was written.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!data) {
    return NextResponse.json(
      { error: "Policy not saved — only a controller or CFO may set expense policy." },
      { status: 403 },
    );
  }
  return NextResponse.json({ id: data.id });
}
