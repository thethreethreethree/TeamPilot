import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET  /api/finance/bank/accounts — bank accounts + their GL cash balance + unmatched count (positions).
 * POST /api/finance/bank/accounts — create a bank account linked to a cash GL account (configure-level).
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ accounts: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_bank_positions")
    .select("id, name, institution, mask, currency, is_active, gl_account_id, gl_balance, unmatched_count")
    .order("name");
  if (error) return NextResponse.json({ accounts: [] });
  return NextResponse.json({ accounts: data });
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(120),
    institution: z.string().max(120).optional(),
    mask: z.string().max(20).optional(),
    currency: z.string().length(3).optional(),
    glAccountId: z.string().uuid(),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });
  const body = await readBody(req, CreateSchema);
  if (body instanceof NextResponse) return body;

  const { data, error } = await sb
    .from("fin_bank_accounts")
    .insert({
      company_id: companyId,
      name: body.name,
      institution: body.institution ?? null,
      mask: body.mask ?? null,
      currency: body.currency ?? null,
      gl_account_id: body.glAccountId,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[bank/accounts] insert failed:", error.message);
    return NextResponse.json({ error: "Couldn't create the bank account (duplicate name, or you need finance-configure permission)." }, { status: 400 });
  }
  return NextResponse.json({ id: data.id });
}
