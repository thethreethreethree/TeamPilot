import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { companyPeople, teamsIn } from "@/lib/coach/remote/teamScope";

/**
 * GET /api/coach/remote/teams — the managers' teams this manager may narrow the coaching screens to (2026-11-26; ledger
 * F10.9 / F16.6). A team is a manager with at least one report; only managers the caller may see (their own tree, or
 * everyone for a company admin — the database's rss_tree_filter) are listed. Managers only. Company-pinned.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-teams", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const admin = createAdminClient();
  try {
    const people = await companyPeople(admin, mgr.companyId);
    const teams = teamsIn(people);
    const visible = new Set(await treeFilterReps(req, teams.map((t) => t.id).filter((id) => id !== mgr.userId)));
    const shown = teams.filter((t) => t.id === mgr.userId || visible.has(t.id));
    const { data: profs, error } = shown.length
      ? await admin.from("profiles").select("id, full_name").eq("company_id", mgr.companyId).in("id", shown.map((t) => t.id))
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    const name = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [String(p.id), p.full_name ?? "Unnamed teammate"]));
    return NextResponse.json({
      teams: shown
        .map((t) => ({ id: t.id, name: t.id === mgr.userId ? "My team" : `${name.get(t.id) ?? "Unnamed teammate"}'s team`, size: t.size, mine: t.id === mgr.userId }))
        .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name)),
    });
  } catch (e) {
    console.error(`[teams] failed company=${mgr.companyId}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load teams." }, { status: 500 });
  }
}
