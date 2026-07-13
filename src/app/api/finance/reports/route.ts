import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Custom report builder (0171).
 *
 * GET             — the saved reports.
 * GET ?run=<id>   — run one.
 * POST            — save a definition · delete one.
 *
 * NOTE WHAT THIS ROUTE NEVER ACCEPTS: a query, an expression, a WHERE clause, a column name, a table name,
 * or a company id. It accepts a MEASURE, a GROUP-BY, an optional account type, and a period — each one an
 * enum, each one re-validated by a CHECK constraint in the database.
 *
 * The reporting SQL lives entirely in fin_run_report, written once, with auth_company_id() hard-wired into
 * its WHERE clause rather than passed as a parameter. That function is SECURITY DEFINER, so if a tenant id
 * were ever a parameter, a caller could name someone else's company and the elevated function would
 * comply. It is not a parameter. It cannot become one by accident from this file.
 */

const MEASURES = ["debit", "credit", "net", "closing_balance"] as const;
const GROUPS = ["account", "account_type", "cost_center", "project", "month", "vendor", "customer"] as const;
const PERIODS = [
  "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "all_time",
] as const;

export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ reports: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const runId = new URL(req.url).searchParams.get("run");
  if (runId) {
    const { data, error } = await sb.rpc("fin_run_report", { p_id: runId });
    // The function RAISES for another tenant's report rather than returning empty — an empty result would
    // read as "this report has no data", which is a very different (and reassuring) claim.
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ rows: data ?? [] });
  }

  const { data, error } = await sb
    .from("fin_report_definitions")
    .select("id, name, measure, group_by, account_type, period, created_by, created_at")
    .order("name");
  if (error) return NextResponse.json({ error: "Could not load reports." }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      name: z.string().min(1).max(80),
      measure: z.enum(MEASURES),
      groupBy: z.enum(GROUPS),
      accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]).optional(),
      period: z.enum(PERIODS),
    })
    .strict(),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }).strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  if (b.action === "delete") {
    // RLS decides who may delete (the author, or a controller). We do not re-implement that here — a
    // second, weaker copy of an authz rule is how the two drift apart.
    const { error } = await sb.from("fin_report_definitions").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await sb
    .from("fin_report_definitions")
    .insert({
      name: b.name.trim(),
      measure: b.measure,
      group_by: b.groupBy,
      account_type: b.accountType ?? null,
      period: b.period,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ id: data.id });
}
