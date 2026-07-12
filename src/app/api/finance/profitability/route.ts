import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/finance/profitability — margin by project, cost center, and customer (derived from posted,
 * dimension-tagged journal lines: revenue − cost, and contribution margin = revenue − direct cost).
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ projects: [], costCenters: [], customers: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const [pr, cc, cu] = await Promise.all([
    sb.from("fin_project_profitability").select("project_id, code, name, status, budget, revenue, direct_cost, total_cost").order("revenue", { ascending: false }),
    sb.from("fin_cost_center_profitability").select("cost_center_id, code, name, revenue, direct_cost, total_cost").order("total_cost", { ascending: false }),
    sb.from("fin_customer_profitability").select("customer_id, name, revenue, total_cost").order("revenue", { ascending: false }),
  ]);
  return NextResponse.json({ projects: pr.data ?? [], costCenters: cc.data ?? [], customers: cu.data ?? [] });
}
