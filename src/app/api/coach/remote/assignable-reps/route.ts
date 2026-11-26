import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterRepsChecked } from "@/lib/api/treeAccess";

/**
 * GET /api/coach/remote/assignable-reps — the people this manager may give training to (2026-11-26; review of the course
 * builds). The Assign pickers used /api/team, which lists the whole company, so a manager could pick reps the assign
 * routes then refused. This is the same answer those routes give: active people in the company, the reporting tree's
 * verdict (rss_tree_filter; everyone for a company admin), never the manager themself. A tree check that can't be
 * answered is a 503, never an empty team. Managers only. Company-pinned.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-assignable-reps", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await fetchAllPagedResult<{ id: string; full_name: string | null }>(
    (from, to) => admin.from("profiles").select("id, full_name").eq("company_id", mgr.companyId).eq("status", "active").order("id", { ascending: true }).range(from, to),
    { label: "assignable reps", maxRows: 50_000 },
  );
  if (error) {
    console.error(`[assignable-reps] read failed company=${mgr.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load your team." }, { status: 500 });
  }
  const others = (data ?? []).filter((p) => String(p.id) !== mgr.userId);
  const allowed = await treeFilterRepsChecked(req, others.map((p) => String(p.id)));
  if (allowed === null) return NextResponse.json({ error: "Couldn't check your reporting tree — try again." }, { status: 503 });
  const ok = new Set(allowed);
  const members = others
    .filter((p) => ok.has(String(p.id)))
    .map((p) => ({ id: String(p.id), full_name: p.full_name }))
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  return NextResponse.json({ members });
}
