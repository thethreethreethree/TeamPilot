import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/close-year — { fiscalYear, action: "close" | "reopen" }.
 * Delegates to fin_close_year / fin_reopen_year (DEFINER, configure-gated): posts the closing (or
 * reversing) entry into Retained Earnings and locks (or unlocks) the year.
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
