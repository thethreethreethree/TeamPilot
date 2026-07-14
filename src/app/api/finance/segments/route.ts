import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Net profitability by segment + idle resources (0177).
 *
 * `net_profit` is NULL wherever overhead could not be allocated — never the gross margin. Falling back to
 * the unloaded figure under a heading that says "net" would report a customer as profitable at the exact
 * moment we could not work out what serving them cost.
 *
 * The idle-resource list reports a FACT ("this consumed £X and produced £0"), never a verdict. R&D consumes
 * and produces nothing for two years; so does a new market; so does the finance department. A system that
 * called those "waste" would be confidently wrong about the most important money a company spends, and a
 * founder who trusted it would cut precisely the wrong things.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ customers: [], costCenters: [], idle: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [cu, cc, idle, depr] = await Promise.all([
    sb.from("fin_net_profit_by_customer").select("customer_id, customer_name, revenue, direct_cost, allocated_overhead, net_profit").order("revenue", { ascending: false }),
    sb.from("fin_net_profit_by_cost_center").select("cost_center_id, code, name, revenue, direct_cost, allocated_overhead, net_profit").order("revenue", { ascending: false }),
    sb.from("fin_idle_resources").select("kind, id, name, cost_consumed, revenue, last_activity").order("cost_consumed", { ascending: false }),
    sb.from("fin_fully_depreciated_assets").select("asset_id, name, cost, accumulated"),
  ]);

  if (cu.error && cc.error) {
    return NextResponse.json({ error: "Could not load segment profitability." }, { status: 500 });
  }

  return NextResponse.json({
    customers: cu.data ?? [],
    costCenters: cc.data ?? [],
    idle: idle.data ?? [],
    fullyDepreciated: depr.data ?? [],
  });
}
