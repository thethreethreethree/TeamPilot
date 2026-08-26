import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateDissectContent } from "@/lib/coach/v5/coachAssessmentAggregate";
import { getAllTimeKpi } from "@/lib/data/doorlog";

/**
 * GET /api/coach/sales-session/my-training — the CALLER's OWN sales-coach training focuses (founder 2026-08-26,
 * "accessible by the individual reps on their portal"). A rep sees their own growth areas + strategy gaps (what to
 * work on) drawn from their OWN Dissects, plus their door activity — never anyone else's. No manager gate: this is
 * self-data. §3.4: an honest empty state (no dissects yet) rather than a fabricated list.
 */

const CONTENT_N = 50;

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const uid = auth.user.id;

  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("events")
    .select("payload, created_at")
    .eq("kind", "coach.dissect_generated")
    .eq("actor", uid)
    .order("created_at", { ascending: false })
    .limit(CONTENT_N);
  if (error) return NextResponse.json({ degraded: true });

  const rows = (events ?? []) as { payload: unknown; created_at: unknown }[];
  const content = aggregateDissectContent(rows);
  const door = await getAllTimeKpi(uid).catch(() => null); // best-effort — never a false 0

  const uniq = (xs: string[], n: number) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))].slice(0, n);
  return NextResponse.json({
    dissectCount: rows.length,
    growthAreas: uniq(content.growth, 8),
    strategies: uniq(content.strategies, 8),
    strengths: uniq(content.strengths, 6),
    doorKpi: door,
  });
}
