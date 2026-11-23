import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { cleanStageLabel, stageKey, stagesInUse } from "@/lib/coach/remote/stageTraining";

/**
 * /api/coach/remote/scenarios/stages — which pipeline stages each practice scenario is for (training by deal stage,
 * 2026-11-23, migration 0310). Managers only.
 *   GET → { available, tags: [{ scenarioId, label }], stages: string[] } — `stages` are the stage names already used on
 *         the company's prospects, offered as choices so a tag matches what reps actually type.
 *   PUT { scenarioId, stage, on } → appends a tag/untag event (never an edit, §3.1).
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Training by stage is waiting on database migration 0310.";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenario-stages", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  // Tags belong to company-wide scenarios (service role, company-pinned). Stage names come from prospects, which are rep
  // data, so they are read through the manager's OWN client: the reporting tree (0273) decides whose names appear.
  // Both reads stop at PostgREST's 1000-row cap; the names are suggestions, so the 1000 most recent prospects suffice.
  const [tags, labels] = await Promise.all([
    createAdminClient().from("training_scenario_stages_current").select("scenario_id, stage_label").eq("company_id", mgr.companyId).limit(1000),
    (callerScopedDb(req) ?? (await createClient()))
      .from("remote_prospects_current")
      .select("stage_label")
      .not("stage_label", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (tags.error && MISSING.has(String(tags.error.code))) return NextResponse.json({ available: false, reason: NOT_READY });
  if (tags.error || labels.error) {
    console.error(`[scenario-stages] read failed: ${tags.error?.message ?? labels.error?.message}`);
    return NextResponse.json({ error: "Couldn't load the stages." }, { status: 500 });
  }
  return NextResponse.json({
    available: true,
    tags: ((tags.data ?? []) as Array<{ scenario_id: string; stage_label: string }>).map((t) => ({ scenarioId: t.scenario_id, label: t.stage_label })),
    stages: stagesInUse(((labels.data ?? []) as Array<{ stage_label: string | null }>).map((l) => l.stage_label)),
  });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenario-stages-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { scenarioId?: unknown; stage?: unknown; on?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const scenarioId = typeof b.scenarioId === "string" ? b.scenarioId : "";
  const label = cleanStageLabel(b.stage);
  if (!scenarioId || !label || typeof b.on !== "boolean") return NextResponse.json({ error: "Name a scenario and a stage (up to 60 characters)." }, { status: 400 });
  const admin = createAdminClient();
  const { data: scen, error: sErr } = await admin.from("training_scenarios").select("id, retired_at").eq("company_id", mgr.companyId).eq("id", scenarioId).maybeSingle();
  if (sErr) {
    console.error(`[scenario-stages] scenario read failed: ${sErr.message}`);
    return NextResponse.json({ error: "Couldn't check the scenario." }, { status: 500 });
  }
  if (!scen) return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
  if (b.on && scen.retired_at) return NextResponse.json({ error: "That scenario is retired." }, { status: 409 });
  const { error } = await admin.from("training_scenario_stages").insert({
    company_id: mgr.companyId,
    scenario_id: scenarioId,
    stage_label: label,
    stage_key: stageKey(label),
    is_on: b.on,
    set_by: mgr.userId,
  });
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[scenario-stages] write failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
