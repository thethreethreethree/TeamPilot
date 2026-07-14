import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Cost per outcome (0179) — where the ledger meets the diagnosis chain.
 *
 * The denominator is a resolution that HELD, never a resolution that was merely recorded.
 *
 * Cost-per-resolution is the easy metric and it is actively corrupting: the cheapest way to improve it is
 * to resolve more problems — close things faster, mark them done, move on. It cannot distinguish a problem
 * that was FIXED from a problem that was CLOSED. The number would improve, everyone would be doing exactly
 * what they were asked, and the same problems would keep coming back.
 *
 * So `cost_per_outcome` counts only durability='held', and `cost_of_reopened` is returned alongside it as a
 * first-class figure: the money spent on fixes that came back. No cost-per-resolution metric can produce
 * that number, because to it a reopened problem is just another resolution to count.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ summary: null, problems: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [sum, cov, byProblem] = await Promise.all([
    sb.from("fin_cost_per_outcome").select("*").maybeSingle(),
    sb.from("fin_cost_attribution_coverage").select("tagged_cost, untagged_cost, tagged_share").maybeSingle(),
    sb.from("fin_cost_by_problem").select("problem_id, problem_title, cost").order("cost", { ascending: false }).limit(50),
  ]);

  if (sum.error) return NextResponse.json({ error: "Could not compute cost per outcome." }, { status: 500 });

  return NextResponse.json({
    summary: sum.data,
    // How much of the company's spend is actually attributed. This is the reader's guide to how much the
    // headline is worth — and it is returned always, never hidden when it is embarrassing.
    coverage: cov.error ? null : cov.data,
    problems: byProblem.data ?? [],
  });
}
