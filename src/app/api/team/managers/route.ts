import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/team/managers — who reports to whom in the caller's company (RSS Phase 0 step 3/4, Gong F2.4).
 * Returns { available: true, byMember: { [memberId]: managerId | null }, tree }. `tree` (0287) is the database's own
 * verdict — { active, blockers }: whether reporting lines are in force (rss_tree_active) and the reps without a manager
 * who keep them off (rss_tree_blockers, the same rule). Consumed as given, never re-derived here (§2.2). null when 0287
 * is not applied yet.
 *
 * SEPARATE FROM fetchTeam ON PURPOSE. Adding `manager_id` to the roster query would make the whole Team
 * page fail until migration 0272 is applied. Read here, a missing column costs only the manager control,
 * and says so: `{ available: false, reason }` — never an empty map that reads as "nobody has a manager".
 *
 * Any member of the company may read it: a person seeing who they report to, and who reports to whom, is
 * the A10 rule (see what the system sees about you). Company-pinned on the service-role read (INV29).
 */
const MISSING_COLUMN = new Set(["42703", "PGRST204"]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-managers", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, manager_id")
    .eq("company_id", ctx.companyId);
  if (error) {
    if (MISSING_COLUMN.has(String(error.code))) {
      return NextResponse.json({ available: false, reason: "Reporting lines are waiting on database migration 0272." });
    }
    // eslint-disable-next-line no-console
    console.error(`[team/managers] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load reporting lines." }, { status: 500 });
  }

  const byMember: Record<string, string | null> = {};
  for (const r of (data ?? []) as Array<{ id: string; manager_id: string | null }>) byMember[r.id] = r.manager_id ?? null;
  const admin = createAdminClient();
  const [act, blk] = await Promise.all([
    admin.rpc("rss_tree_active", { company: ctx.companyId }),
    admin.rpc("rss_tree_blockers", { company: ctx.companyId }),
  ]);
  const tree =
    act.error || blk.error
      ? null
      : {
          active: act.data === true,
          blockers: ((blk.data ?? []) as Array<string | { rss_tree_blockers: string }>).map((b) => (typeof b === "string" ? b : String(b.rss_tree_blockers))),
        };
  if (act.error || blk.error) console.error(`[team/managers] tree verdict unavailable company=${ctx.companyId}: ${(act.error ?? blk.error)?.message}`);
  return NextResponse.json({ available: true, byMember, tree });
}
