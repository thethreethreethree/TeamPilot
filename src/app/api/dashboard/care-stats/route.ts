import { NextResponse } from "next/server";
import { fetchCareCommandStats } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/care-stats
 *
 * Lightweight C.A.R.E counts for the Command Center stat
 * row. Per TT.md A21 — surfaces support activity alongside
 * tasks/signals/problems/resolutions so the operational
 * hub is complete for tenants running C.A.R.E.
 *
 * Auth: any signed-in user with a company can see counts
 * for their company (RLS scopes the underlying queries).
 * Non-members see null and the section is hidden.
 *
 * Returns:
 *   200 { stats: CareCommandStats | null }
 *   401 if not authenticated
 *
 * Errors degrade to { stats: null } so Command Center
 * silently omits the section instead of breaking — same
 * pattern as the silently-degrading existing loaders.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const stats = await fetchCareCommandStats();
  return NextResponse.json({ stats });
}
