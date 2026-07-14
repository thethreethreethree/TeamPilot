import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Cash-flow forecast (0175).
 *
 * Every figure returned traces to a document a human created — an unpaid invoice, an approved bill, a
 * scheduled payment, a recurring bill. Nothing here is extrapolated, modelled, or averaged.
 *
 * That means the forecast is SILENT about revenue you have not invoiced yet, and will therefore look
 * pessimistic to a growing company. The honest response is not to pad it with a trend; it is to say so.
 * `gap` is that statement: how much you must win, from business not yet invoiced, in the next 90 days.
 */
export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ days: [], gap: null });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const horizon = Number(new URL(req.url).searchParams.get("days") ?? 90);
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 365) {
    return NextResponse.json({ error: "Horizon must be 1–365 days." }, { status: 400 });
  }

  const [fc, gap, commitments] = await Promise.all([
    sb.rpc("fin_cash_forecast", { p_days: horizon }),
    sb.from("fin_cash_gap").select("cash_now, committed_in, committed_out, gap").maybeSingle(),
    sb
      .from("fin_cash_commitments_net")
      .select("direction, expected_on, amount, source_type, source_ref")
      .order("expected_on")
      .limit(200),
  ]);

  if (fc.error) return NextResponse.json({ error: fc.error.message }, { status: 403 });

  return NextResponse.json({
    days: fc.data ?? [],
    // null (not zero) when we could not compute it. A gap of 0 means "committed cash covers you"; a gap we
    // could not read means we do not know — and on a runway figure those must never be the same value.
    gap: gap.error ? null : gap.data,
    commitments: commitments.data ?? [],
  });
}
