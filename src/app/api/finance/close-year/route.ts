import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/close-year — { fiscalYear, action: "close" | "reopen" }.
 * Delegates to fin_close_year / fin_reopen_year (DEFINER, configure-gated): posts the closing (or
 * reversing) entry into Retained Earnings and locks (or unlocks) the year.
 *
 * KNOWN LIMITATION (audit 2026-07-23 — CALENDAR fiscal year only): fin_close_year (0151:55-56) closes
 * revenue/expense where `extract(year from entry_date) = fiscalYear`, i.e. Jan-Dec of that year. There is
 * NO fiscal-year-start config in fin_settings, so a company on a non-calendar FY (e.g. Jul-Jun) would close
 * the WRONG window and permanently misstate Retained Earnings. Same assumption drives budget variance
 * (0149) + variance alerts (0182). Until non-calendar FY is supported (add fin_settings.fiscal_year_start_month
 * + switch the extract(year) sites to a fiscal-year date window), the UI must present FY as = calendar year,
 * or a non-calendar company will get silently-wrong closes. See the ground-up-audit doc's calendar-FY finding.
 */
const Body = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  action: z.enum(["close", "reopen"]),
});

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const fn = body.action === "close" ? "fin_close_year" : "fin_reopen_year";
  const { data, error } = await sb.rpc(fn, { p_fiscal_year: body.fiscalYear });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ entryId: data });
}
