import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { fetchAllPaged } from "@/lib/supabase/paginate";

/**
 * GET /api/coach/sales-session/team-activity — per-rep session ACTIVITY for the manager's roster (founder 2026-08-27:
 * "monitor their usage"). One company-scoped read of the last 30 days, aggregated by agent_id in code → each rep's
 * session count + last-active + how many had a recording. §A18: this is activity (usage), never a ranking; the caller
 * renders it unsorted alongside the roster. §3.4: honest empty (a rep with no sessions is simply absent from the map).
 */

const WINDOW_DAYS = 30;

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });
  const isManager = isSalesCoachManager({
    role: profile?.role ?? null,
    sales_coach_role: profile?.sales_coach_role ?? null,
    company_id: companyId,
  });
  if (!isManager) return NextResponse.json({ error: "Manager only." }, { status: 403 });

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let rows: { agent_id: string | null; started_at: string; audio_asset_url: string | null }[];
  try {
    rows = await fetchAllPaged<{ agent_id: string | null; started_at: string; audio_asset_url: string | null }>(
      (from, to) =>
        admin
          .from("coaching_sessions")
          .select("agent_id, started_at, audio_asset_url")
          .eq("company_id", companyId)
          .gte("started_at", cutoff)
          .range(from, to),
      { label: "team-activity" },
    );
  } catch (e) {
    console.error("[team-activity GET] failed:", e);
    return NextResponse.json({ error: "Couldn't load team activity." }, { status: 500 });
  }

  const byAgent: Record<string, { count: number; lastActiveAt: string; withAudio: number }> = {};
  for (const r of rows) {
    const id = r.agent_id;
    if (!id) continue;
    const cur = byAgent[id] ?? { count: 0, lastActiveAt: "", withAudio: 0 };
    cur.count += 1;
    if (r.audio_asset_url) cur.withAudio += 1;
    if (!cur.lastActiveAt || r.started_at > cur.lastActiveAt) cur.lastActiveAt = r.started_at;
    byAgent[id] = cur;
  }
  return NextResponse.json({ byAgent, windowDays: WINDOW_DAYS });
}
