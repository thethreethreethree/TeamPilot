import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { REMOTE_RUBRIC } from "@/lib/coach/pitchScore/rubricRegistry";

/**
 * /api/coach/remote/scenarios/elements — which rubric items each practice scenario trains (2026-11-23, migration 0326;
 * "rep needs"). Managers only.
 *   GET → { available, items: [{ id, label }], tags: [{ scenarioId, elementId }] } — items are the phone & video rubric's.
 *   PUT { scenarioId, elementId, on } → appends a tag/untag event (never an edit, §3.1). Only a real rubric item.
 * Tags belong to company-wide scenarios: service role, company-pinned, after requireSalesCoachManager (as 0310's stages).
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Rubric tags are waiting on database migration 0326.";
const ITEMS = REMOTE_RUBRIC.elements.map((e) => ({ id: e.id, label: e.label }));

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenario-elements", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { data, error } = await createAdminClient().from("training_scenario_elements_current").select("scenario_id, element_id").eq("company_id", mgr.companyId).limit(1000);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, reason: NOT_READY, items: ITEMS, tags: [] });
    console.error(`[scenario-elements] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the rubric tags." }, { status: 500 });
  }
  return NextResponse.json({
    available: true,
    items: ITEMS,
    tags: ((data ?? []) as Array<{ scenario_id: string; element_id: string }>).map((t) => ({ scenarioId: t.scenario_id, elementId: t.element_id })),
  });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenario-elements-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { scenarioId?: unknown; elementId?: unknown; on?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const scenarioId = typeof b.scenarioId === "string" ? b.scenarioId : "";
  const elementId = typeof b.elementId === "string" ? b.elementId : "";
  if (!scenarioId || typeof b.on !== "boolean") return NextResponse.json({ error: "Name a scenario and a rubric item." }, { status: 400 });
  if (!REMOTE_RUBRIC.elementsById.has(elementId)) return NextResponse.json({ error: "That isn't an item on the phone & video rubric." }, { status: 400 });
  const admin = createAdminClient();
  const { data: scen, error: sErr } = await admin.from("training_scenarios").select("id, retired_at").eq("company_id", mgr.companyId).eq("id", scenarioId).maybeSingle();
  if (sErr) {
    console.error(`[scenario-elements] scenario read failed: ${sErr.message}`);
    return NextResponse.json({ error: "Couldn't check the scenario." }, { status: 500 });
  }
  if (!scen) return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
  if (b.on && scen.retired_at) return NextResponse.json({ error: "That scenario is retired." }, { status: 409 });
  const { error } = await admin.from("training_scenario_elements").insert({ company_id: mgr.companyId, scenario_id: scenarioId, element_id: elementId, is_on: b.on, set_by: mgr.userId });
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[scenario-elements] write failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
