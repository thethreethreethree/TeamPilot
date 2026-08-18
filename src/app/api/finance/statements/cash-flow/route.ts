import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";

/**
 * GET /api/finance/statements/cash-flow?periodId=…
 *
 * The Cash Flow Statement (migration 0164): where the company's money actually came from and went.
 *
 * WHAT THIS ROUTE REFUSES TO DO: hide the 'unclassified' section.
 *
 * It would be trivially easy — and it would make the statement look finished — to fold unclassified
 * movements into Operating before returning. Do not. The net change in cash ties out either way, so the
 * lie would be undetectable: a company funded by an owner's injection would appear to be generating cash
 * from trading, and every balance check in this system would agree.
 *
 * So unclassified is returned as its own section, and the response carries an explicit flag so the UI
 * cannot accidentally render a tidy statement over an unattributed remainder. A visible gap is a prompt
 * to classify an account. An invisible one is a false statement with a clean bill of health.
 */

const SECTION_ORDER = ["operating", "investing", "financing", "unclassified"] as const;

export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ sections: [], netChange: 0 });

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const periodId = req.nextUrl.searchParams.get("periodId");

  // PAGED (audit 2026-08-19): with no periodId this sums EVERY period's rows in JS; fin_cash_flow_summary is
  // per (period_id, section), so a tenant with years of monthly books crosses the 1000-row PostgREST cap and the
  // all-time statement + netChange silently truncate. Paging fetches the full set; the honest 500 below is kept.
  const { data, error } = await fetchAllPagedResult<{ period_id: string; section: string; net_amount: number }>(
    (from, to) => {
      const base = sb.from("fin_cash_flow_summary").select("period_id, section, net_amount");
      return (periodId ? base.eq("period_id", periodId) : base).range(from, to);
    },
    { label: "cash flow summary" },
  );

  // A read failure must never render as a zeroed statement. "We could not load your cash flow" and
  // "your company moved no cash" are wildly different facts, and only one of them is safe to act on.
  if (error) {
    return NextResponse.json({ error: "Could not load the cash flow statement." }, { status: 500 });
  }

  const rows = data ?? [];
  const byId = new Map<string, number>();
  for (const r of rows) {
    byId.set(r.section as string, (byId.get(r.section as string) ?? 0) + Number(r.net_amount ?? 0));
  }

  const sections = SECTION_ORDER.map((s) => ({ section: s, netAmount: byId.get(s) ?? 0 }));
  const netChange = sections.reduce((sum, s) => sum + s.netAmount, 0);

  const unclassified = byId.get("unclassified") ?? 0;

  return NextResponse.json({
    sections,
    netChange,
    // Surfaced deliberately, so no caller can render a tidy statement while money sits unattributed.
    // If this is non-zero, the statement is INCOMPLETE, not merely untidy — some of the cash that moved
    // is not yet explained by any category, and the sections below it cannot be trusted as a description
    // of how the company generates money.
    hasUnclassified: Math.abs(unclassified) > 0.005,
    unclassifiedAmount: unclassified,
  });
}
