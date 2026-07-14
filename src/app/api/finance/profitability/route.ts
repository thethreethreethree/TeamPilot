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
  const [pr, cc, cu, oh, un] = await Promise.all([
    sb.from("fin_project_profitability").select("project_id, code, name, status, budget, revenue, direct_cost, total_cost").order("revenue", { ascending: false }),
    sb.from("fin_cost_center_profitability").select("cost_center_id, code, name, revenue, direct_cost, total_cost").order("total_cost", { ascending: false }),
    sb.from("fin_customer_profitability").select("customer_id, name, revenue, total_cost").order("revenue", { ascending: false }),
    // 0173: overhead each project ABSORBED. Direct-cost margin systematically FLATTERS every project,
    // because no project pays rent — so a page that shows only direct margin is quietly telling the founder
    // that every project is more profitable than it is.
    sb.from("fin_overhead_allocation").select("project_id, month, allocated_overhead"),
    // Overhead that could be allocated to NOBODY. Surfaced, never absorbed: if it were folded into the
    // projects, every margin above would improve and nothing would disagree.
    sb.from("fin_overhead_unallocated").select("month, unallocated_overhead"),
  ]);

  // Sum each project's allocated overhead across months. NULL months (overhead existed but no direct cost
  // to divide it by) are NOT counted as 0 — they are counted as UNKNOWN, and a project with any unknown
  // month reports a null loaded margin rather than a flattering one.
  const overheadByProject = new Map<string, { total: number; unknown: boolean }>();
  for (const row of oh.data ?? []) {
    const cur = overheadByProject.get(row.project_id) ?? { total: 0, unknown: false };
    if (row.allocated_overhead == null) cur.unknown = true;
    else cur.total += Number(row.allocated_overhead);
    overheadByProject.set(row.project_id, cur);
  }

  const projects = (pr.data ?? []).map((p) => {
    const o = overheadByProject.get(p.project_id);
    const overhead = o && !o.unknown ? o.total : null;
    return {
      ...p,
      allocated_overhead: overhead,
      // NULL, never the direct margin. Presenting an unloaded figure under a "fully loaded" label would
      // report a project as profitable at the exact moment we could not work out what it cost.
      loaded_margin:
        overhead == null ? null : Number(p.revenue) - Number(p.direct_cost) - overhead,
    };
  });

  return NextResponse.json({
    projects,
    costCenters: cc.data ?? [],
    customers: cu.data ?? [],
    unallocatedOverhead: (un.data ?? []).reduce(
      (s: number, r: { unallocated_overhead: number }) => s + Number(r.unallocated_overhead || 0),
      0,
    ),
  });
}
