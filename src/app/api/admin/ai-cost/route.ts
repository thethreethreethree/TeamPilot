import { NextRequest, NextResponse } from "next/server";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { costReport, type LedgerRow } from "@/lib/coach/remote/costReport";
import type { Price, Unit } from "@/lib/coach/remote/cost";

/**
 * GET /api/admin/ai-cost?day=YYYY-MM-DD — what one UTC day of AI cost (RSS Phase 0 step 6, Gong F28.7).
 * Default: yesterday (the plan's "Looked at": cost per session for yesterday).
 *
 * VENDOR ONLY, AND CROSS-TENANT BY DESIGN. AI cost is ELOSTATE's operating data, not a tenant's (0272 gives
 * ai_usage and ai_prices no tenant policy at all). requireVendorAdmin is the gate — the founders only — and the
 * service role reads every company's rows on purpose, grouped by company.
 *
 * NO PRICE IS INVENTED. ai_prices starts empty; until a price is entered for a provider/model/unit, the report
 * says "price missing" and lists exactly which prices to enter (costReport).
 *
 * BOUNDED, AND SAYS SO. One page of rows (PostgREST's 1000 max); `capped: true` when the day has more, so a
 * partial day is never shown as the whole day.
 */
const PAGE = 1000;
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

function dayRange(day: string | null): { day: string; from: string; to: string } | null {
  const d = day ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const from = new Date(`${d}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) return null;
  return { day: d, from: from.toISOString(), to: new Date(from.getTime() + 86_400_000).toISOString() };
}

export async function GET(req: NextRequest) {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;

  const range = dayRange(req.nextUrl.searchParams.get("day"));
  if (!range) return NextResponse.json({ error: "Use a day like 2026-11-14." }, { status: 400 });

  const sb = createAdminClient();
  const [usageRes, priceRes] = await Promise.all([
    sb
      .from("ai_usage")
      .select("company_id, session_id, engine, provider, model, input_tokens, output_tokens, audio_seconds, created_at")
      .gte("created_at", range.from)
      .lt("created_at", range.to)
      .order("created_at", { ascending: true })
      .limit(PAGE + 1),
    sb.from("ai_prices").select("provider, model, unit, usd_per_unit, effective_from"),
  ]);
  const err = usageRes.error ?? priceRes.error;
  if (err) {
    if (MISSING_TABLE.has(String(err.code))) {
      return NextResponse.json({ error: "The AI cost ledger is waiting on database migration 0272." }, { status: 503 });
    }
    console.error(`[admin/ai-cost] read failed: ${err.message}`);
    return NextResponse.json({ error: "Couldn't load AI cost." }, { status: 500 });
  }

  const raw = (usageRes.data ?? []) as Array<Record<string, unknown>>;
  const capped = raw.length > PAGE;
  const rows: LedgerRow[] = raw.slice(0, PAGE).map((r) => ({
    companyId: (r.company_id as string | null) ?? null,
    sessionId: (r.session_id as string | null) ?? null,
    engine: String(r.engine),
    provider: String(r.provider),
    model: String(r.model),
    inputTokens: Number(r.input_tokens ?? 0),
    outputTokens: Number(r.output_tokens ?? 0),
    audioSeconds: Number(r.audio_seconds ?? 0),
    at: new Date(String(r.created_at)),
  }));
  const prices: Price[] = ((priceRes.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
    provider: String(p.provider),
    model: String(p.model),
    unit: p.unit as Unit,
    usdPerUnit: Number(p.usd_per_unit),
    effectiveFrom: new Date(`${String(p.effective_from)}T00:00:00.000Z`),
  }));

  const report = costReport(rows, prices);

  // Company names, for reading the report. Vendor-only like everything here.
  const ids = [...new Set(rows.map((r) => r.companyId).filter((x): x is string => !!x))];
  let companyNames: Record<string, string> = {};
  if (ids.length) {
    const { data: cos } = await sb.from("companies").select("id, name").in("id", ids);
    companyNames = Object.fromEntries(((cos ?? []) as Array<{ id: string; name: string | null }>).map((c) => [c.id, c.name ?? c.id]));
  }

  return NextResponse.json({ day: range.day, capped, report, companyNames });
}
