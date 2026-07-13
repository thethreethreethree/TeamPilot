import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/kpis — revenue, burn, runway, DSO, margin (migration 0165).
 *
 * THE ONE RULE THIS ROUTE MUST NOT BREAK: null stays null.
 *
 * It is a reflex to write `?? 0` when serialising numbers — it removes a TypeScript complaint and makes
 * the UI simpler. Doing it here would destroy the entire point of 0165. Those nulls are load-bearing:
 *
 *   dso_days = null          means "no revenue in the window, so days-sales-outstanding is undefined"
 *   dso_days = 0             means "customers pay us instantly"
 *
 *   runway_months = null     means "not burning — runway is not a finite number"
 *   runway_months = 0        means "out of money now"
 *
 *   gross_margin_pct = null  means "we do not track COGS yet, so we cannot compute this"
 *   gross_margin_pct = 0     means "we sell at exactly cost"
 *
 * In every pair the second reading is alarming, false, and actionable — someone would make a decision on
 * it. So the nulls are passed through untouched, and `cogsTracked` is exposed so the UI can say WHY the
 * margin is missing rather than showing a blank a user will read as a bug.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ kpis: null });

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_kpis")
    .select(
      "win_from, win_to, revenue, expenses, net_profit, cash_balance, ar_outstanding, monthly_burn, runway_months, dso_days, gross_margin_pct, net_margin_pct, cogs_tracked",
    )
    .maybeSingle();

  // A read failure must not render as a dashboard of zeroes. "We could not load your KPIs" and "your
  // company has no revenue, no cash and no receivables" are wildly different claims, and the second one
  // would send someone into a panic — or, worse, into a board meeting.
  if (error) {
    return NextResponse.json({ error: "Could not load KPIs." }, { status: 500 });
  }

  if (!data) {
    // No posted activity yet. Explicitly distinguished from an error above: this is a true, calm empty.
    return NextResponse.json({ kpis: null, reason: "no_activity" });
  }

  return NextResponse.json({
    kpis: {
      windowFrom: data.win_from,
      windowTo: data.win_to,
      revenue: Number(data.revenue ?? 0),
      expenses: Number(data.expenses ?? 0),
      netProfit: Number(data.net_profit ?? 0),
      cashBalance: Number(data.cash_balance ?? 0),
      arOutstanding: Number(data.ar_outstanding ?? 0),

      // Deliberately NOT coalesced. See the header — each null carries a meaning that a 0 would invert.
      monthlyBurn: data.monthly_burn === null ? null : Number(data.monthly_burn),
      runwayMonths: data.runway_months === null ? null : Number(data.runway_months),
      dsoDays: data.dso_days === null ? null : Number(data.dso_days),
      grossMarginPct: data.gross_margin_pct === null ? null : Number(data.gross_margin_pct),
      netMarginPct: data.net_margin_pct === null ? null : Number(data.net_margin_pct),

      // Lets the UI explain a missing gross margin ("we don't track COGS yet") instead of rendering a
      // blank the user will read as a broken dashboard.
      cogsTracked: Boolean(data.cogs_tracked),
    },
  });
}
