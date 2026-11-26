import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { engageStats, type EnrolAction, type Step } from "@/lib/coach/remote/engage/flows";

/**
 * GET /api/coach/remote/engage/stats?days=30|90 — Engage analytics (plan E2; Gong F26.7–F26.9), per flow and per rep:
 * people enrolled, steps done, emails, calls, connect rate, meetings booked, replies, opt-outs — over the activities the
 * caller can see (0377's RLS: their own deals, a manager's tree), in the window. A failed read is a 500.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "engage-stats", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const days = req.nextUrl.searchParams.get("days") === "90" ? 90 : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = callerScopedDb(req) ?? (await createClient());
  try {
    const enrolments = await fetchAllPaged<{ id: string; flow_id: string; rep_id: string }>((from, to) => db.from("engage_enrolments").select("id, flow_id, rep_id").order("id").range(from, to), { label: "enrolments", maxRows: 50_000 });
    const acts = await fetchAllPaged<{ id: number; enrolment_id: string; step_index: number; action: EnrolAction; outcome: string | null }>(
      (from, to) => db.from("engage_activities").select("id, enrolment_id, step_index, action, outcome").gte("created_at", since).order("id").range(from, to),
      { label: "activities", maxRows: 200_000 },
    );
    const flowIds = [...new Set(enrolments.map((e) => e.flow_id))];
    const steps = new Map<string, Step[]>();
    const names = new Map<string, string>();
    for (let i = 0; i < flowIds.length; i += 150) {
      const { data, error } = await db.from("engage_flows").select("id, name, steps").in("id", flowIds.slice(i, i + 150));
      if (error) throw new Error(error.message);
      for (const f of (data ?? []) as Array<{ id: string; name: string; steps: Step[] }>) {
        steps.set(f.id, f.steps);
        names.set(f.id, f.name);
      }
    }
    const en = new Map(enrolments.map((e) => [e.id, e]));
    const rows = acts.flatMap((a) => {
      const e = en.get(a.enrolment_id);
      if (!e) return [];
      return [{ enrolmentId: a.enrolment_id, flowId: e.flow_id, repId: e.rep_id, stepKind: steps.get(e.flow_id)?.[a.step_index]?.kind ?? null, action: a.action, outcome: a.outcome }];
    });
    const list = enrolments.map((e) => ({ id: e.id, flowId: e.flow_id, repId: e.rep_id }));
    return NextResponse.json({
      days,
      byFlow: engageStats(rows, list, "flow").map((r) => ({ ...r, name: names.get(r.key) ?? "A flow" })),
      byRep: engageStats(rows, list, "rep"),
      viewerId: ctx.userId,
    });
  } catch (e) {
    console.error(`[engage-stats] read failed company=${ctx.companyId}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't load Engage analytics." }, { status: 500 });
  }
}
