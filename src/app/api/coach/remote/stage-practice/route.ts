import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { selfStartDue, stageKey } from "@/lib/coach/remote/stageTraining";

/**
 * /api/coach/remote/stage-practice — practice for a prospect's stage (training by deal stage, 2026-11-23; 0310;
 * founder picker "Rep starts it").
 *   GET ?prospectId= → { stage, canStart, scenarios: [{ id, title, focus, difficulty, lengthMin, assignmentId }] }
 *   POST { prospectId, scenarioId } → { assignmentId } — the rep's own practice (assigned_by = the rep, "self-started"),
 *        due on the prospect's next call. Allowed only for the rep's OWN open prospect, and only for a scenario a
 *        manager tagged with that prospect's stage. Starting it twice returns the same practice.
 * Everything is checked through the caller's client (RLS); only the assignment insert uses the service role, because
 * training_assignments has no insert policy (managers assign through their route the same way).
 */
const MISSING = new Set(["PGRST205", "42P01"]);
type Ctx = { userId: string; companyId: string };
type Prospect = { id: string; rep_id: string; status: string; stage_label: string | null; next_call_date: string | null };
type Scen = { id: string; title: string; focus: string; difficulty: string; length_min: number };

async function matching(req: NextRequest, ctx: Ctx, prospectId: string) {
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: p, error: pErr } = await db.from("remote_prospects_current").select("id, rep_id, status, stage_label, next_call_date").eq("id", prospectId).maybeSingle();
  if (pErr) return { error: 500 as const };
  if (!p) return { error: 404 as const };
  const prospect = p as Prospect;
  const key = stageKey(prospect.stage_label);
  if (prospect.status !== "open" || !key) return { prospect, scenarios: [] as Scen[], db };
  const { data: tags, error: tErr } = await db.from("training_scenario_stages_current").select("scenario_id").eq("stage_key", key);
  if (tErr) return { error: MISSING.has(String(tErr.code)) ? (503 as const) : (500 as const) };
  const ids = [...new Set(((tags ?? []) as Array<{ scenario_id: string }>).map((t) => t.scenario_id))];
  if (!ids.length) return { prospect, scenarios: [] as Scen[], db };
  const { data: scen, error: sErr } = await db.from("training_scenarios").select("id, title, focus, difficulty, length_min").in("id", ids).is("retired_at", null).order("title");
  if (sErr) return { error: 500 as const };
  return { prospect, scenarios: (scen ?? []) as Scen[], db };
}

const ERR: Record<number, string> = { 404: "Prospect not found.", 500: "Couldn't load practice for this stage.", 503: "Training by stage is waiting on database migration 0310." };

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-stage-practice", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const prospectId = req.nextUrl.searchParams.get("prospectId") ?? "";
  if (!prospectId) return NextResponse.json({ error: "Which prospect?" }, { status: 400 });
  const m = await matching(req, ctx, prospectId);
  if ("error" in m) return NextResponse.json({ error: ERR[m.error!] }, { status: m.error });
  const own = m.prospect.rep_id === ctx.userId;
  const byScenario = new Map<string, string>();
  if (own && m.scenarios.length) {
    const { data, error } = await m.db.from("training_assignments").select("id, scenario_id").eq("rep_id", ctx.userId).in("scenario_id", m.scenarios.map((s) => s.id));
    if (error) return NextResponse.json({ error: ERR[500] }, { status: 500 });
    for (const a of (data ?? []) as Array<{ id: string; scenario_id: string }>) byScenario.set(a.scenario_id, a.id);
  }
  return NextResponse.json({
    stage: m.prospect.stage_label,
    canStart: own && m.prospect.status === "open",
    scenarios: m.scenarios.map((s) => ({ id: s.id, title: s.title, focus: s.focus, difficulty: s.difficulty, lengthMin: s.length_min, assignmentId: byScenario.get(s.id) ?? null })),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-stage-practice-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let b: { prospectId?: unknown; scenarioId?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const prospectId = typeof b.prospectId === "string" ? b.prospectId : "";
  const scenarioId = typeof b.scenarioId === "string" ? b.scenarioId : "";
  if (!prospectId || !scenarioId) return NextResponse.json({ error: "Which prospect and scenario?" }, { status: 400 });
  const m = await matching(req, ctx, prospectId);
  if ("error" in m) return NextResponse.json({ error: ERR[m.error!] }, { status: m.error });
  if (m.prospect.rep_id !== ctx.userId) return NextResponse.json({ error: "Only the prospect's own rep can start this practice." }, { status: 403 });
  if (!m.scenarios.some((s) => s.id === scenarioId)) return NextResponse.json({ error: "That scenario isn't set for this prospect's stage." }, { status: 409 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("training_assignments")
    .insert({ company_id: ctx.companyId, scenario_id: scenarioId, rep_id: ctx.userId, assigned_by: ctx.userId, due_at: selfStartDue(m.prospect.next_call_date) })
    .select("id")
    .maybeSingle();
  if (!error && data) return NextResponse.json({ assignmentId: data.id, started: true });
  if (error?.code === "23505") {
    // Already practising it (assigned by a manager or started before): the same practice, not a second one.
    const { data: existing, error: eErr } = await admin.from("training_assignments").select("id").eq("company_id", ctx.companyId).eq("scenario_id", scenarioId).eq("rep_id", ctx.userId).maybeSingle();
    if (!eErr && existing) return NextResponse.json({ assignmentId: existing.id, started: false });
  }
  console.error(`[stage-practice] start failed user=${ctx.userId}: ${error?.message ?? "no row"}`);
  return NextResponse.json({ error: "Couldn't start the practice. Try again." }, { status: 500 });
}
