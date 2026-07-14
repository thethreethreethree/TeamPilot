import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/accounts — the company's Chart of Accounts (RLS: finance view access). Used by
 * the finance UIs to populate account pickers.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ accounts: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("fin_accounts")
    .select("id, code, name, type, is_active, cost_type")
    .eq("is_active", true)
    .order("code");
  if (error) return NextResponse.json({ accounts: [] });
  return NextResponse.json({ accounts: data });
}

/**
 * PATCH /api/finance/accounts — classify an account as a DIRECT or INDIRECT cost.
 *
 * THIS IS NOT A COSMETIC SETTING. It is the input that three separate analytics features silently depend
 * on, and it defaults to 'none':
 *
 *   · Break-even (0176) splits cost into VARIABLE (direct) and FIXED (everything else). With no account
 *     ever marked direct, every cost is treated as fixed — and break-even prints a plausible, WRONG number
 *     rather than failing. It is the most dangerous figure in the system, computed from an empty input.
 *   · Overhead allocation (0173) allocates the INDIRECT pool by each project's share of DIRECT cost. With
 *     nothing marked direct, there is nothing to divide by: every allocation is NULL and every "fully
 *     loaded" margin reads "not yet knowable".
 *   · Project/segment profitability (0148/0177) reports direct cost as zero for everything.
 *
 * So the classification had to become reachable, or those three features were decoration. Configure-level:
 * moving an account between direct and fixed moves the company's break-even point.
 */
const PatchSchema = z
  .object({
    accountId: z.string().uuid(),
    // 'none' is honest for accounts where the distinction does not apply (assets, liabilities, equity).
    costType: z.enum(["direct", "indirect", "none"]),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, PatchSchema);
  if (b instanceof NextResponse) return b;

  // RLS gates who may write the chart of accounts (controller/CFO). Not re-implemented here.
  const { error } = await sb
    .from("fin_accounts")
    .update({ cost_type: b.costType })
    .eq("id", b.accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
