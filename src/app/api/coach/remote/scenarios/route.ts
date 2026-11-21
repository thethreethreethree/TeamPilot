import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { getSession } from "@/lib/data/salesCoach";
import { DIFFICULTIES, SCENARIO_CHANNELS } from "@/lib/coach/remote/training";

/**
 * /api/coach/remote/scenarios — stored practice scenarios (RSS Phase 7, Gong F17.3; migration 0282). Managers only.
 *   GET   → { available, scenarios } (active first)
 *   POST  { title, persona, situation, focus, channel, difficulty, lengthMin, passScore?, sourceSessionId? }
 *   PATCH { id } → retire (never edit — attempts keep their meaning)
 * A scenario "from this call" must name a call the manager can open AND whose rep the tree lets them see.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Training is waiting on database migration 0282.";
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenarios", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { data, error } = await createAdminClient()
    .from("training_scenarios")
    .select("id, title, persona, situation, focus, channel, difficulty, length_min, pass_score, source_session_id, retired_at, created_at")
    .eq("company_id", mgr.companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, reason: NOT_READY });
    console.error(`[scenarios] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load scenarios." }, { status: 500 });
  }
  return NextResponse.json({ available: true, scenarios: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenarios-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const title = str(b.title, 120);
  const persona = str(b.persona, 200);
  const situation = str(b.situation, 600);
  const focus = str(b.focus, 600);
  const channel = (SCENARIO_CHANNELS as readonly string[]).includes(String(b.channel)) ? String(b.channel) : null;
  const difficulty = (DIFFICULTIES as readonly string[]).includes(String(b.difficulty)) ? String(b.difficulty) : null;
  const lengthMin = Number(b.lengthMin);
  const passScore = b.passScore === null || b.passScore === undefined || b.passScore === "" ? null : Number(b.passScore);
  if (!title || !persona || !situation || !focus) return NextResponse.json({ error: "A scenario needs a title, who the prospect is, the situation and the skill to practice." }, { status: 400 });
  if (!channel || !difficulty) return NextResponse.json({ error: "Pick a channel and a difficulty." }, { status: 400 });
  if (!Number.isInteger(lengthMin) || lengthMin < 2 || lengthMin > 30) return NextResponse.json({ error: "Length is 2 to 30 minutes." }, { status: 400 });
  if (passScore !== null && (!Number.isInteger(passScore) || passScore < 0 || passScore > 100)) return NextResponse.json({ error: "A pass mark is 0 to 100." }, { status: 400 });

  let sourceSessionId: string | null = null;
  if (typeof b.sourceSessionId === "string" && b.sourceSessionId) {
    const s = await getSession(b.sourceSessionId, callerScopedDb(req) ?? (await createClient()));
    if (!s || !(await treeAllowsRep(req, s.agentId))) return NextResponse.json({ error: "That call isn't available to you." }, { status: 404 });
    sourceSessionId = s.id;
  }
  const { data, error } = await createAdminClient()
    .from("training_scenarios")
    .insert({
      company_id: mgr.companyId, title, persona, situation, focus, channel, difficulty,
      length_min: lengthMin, pass_score: passScore, source_session_id: sourceSessionId, created_by: mgr.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[scenarios] insert failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't save the scenario." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-scenarios-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { id?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (typeof b.id !== "string") return NextResponse.json({ error: "Which scenario?" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("training_scenarios")
    .update({ retired_at: new Date().toISOString() })
    .eq("company_id", mgr.companyId)
    .eq("id", b.id)
    .is("retired_at", null)
    .select("id");
  if (error) {
    console.error(`[scenarios] retire failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't retire it." }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
