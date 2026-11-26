import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { runAgent, type Action, type Trigger } from "@/lib/coach/remote/engage/agents";

export const maxDuration = 90;

/**
 * /api/coach/remote/agents — agents (Engage plan E5, 0379; Gong M27). Admins and Sales Coach managers (0379's policies).
 *   GET → { agents, runs } — live agents and their latest runs.
 *   POST { name, trigger, actions } → a new agent (checked by the database's rss_valid_agent).
 *   POST { id, enabled } → on or off · POST { retire: id } → retired for good.
 *   POST { test: id, prospectId } → what it would do on that deal, recorded as a test run (nothing is changed).
 */
const TriggerZ = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("deal_stage"), status: z.enum(["open", "won", "lost"]).optional(), label: z.string().trim().min(1).max(60).optional() }),
  // 0380: a tracker first heard on one of a deal's calls. It must be one of the company's trackers.
  z.object({ kind: z.literal("tracker_heard"), tracker_id: z.string().uuid() }),
  // 0382: an open deal's expected close date is this many days away (the nightly job; needs CRON_SECRET).
  z.object({ kind: z.literal("close_date_near"), days: z.number().int().min(1).max(60) }),
]);
const ActionZ = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("brief") }),
  z.object({ kind: z.literal("notify"), to: z.enum(["rep", "owner"]) }),
  z.object({ kind: z.literal("todo"), title: z.string().trim().min(1).max(200), due_days: z.number().int().min(0).max(365).optional() }),
  z.object({ kind: z.literal("webhook") }),
]);
const Body = z.union([
  z.object({ name: z.string().trim().min(1).max(80), trigger: TriggerZ, actions: z.array(ActionZ).min(1).max(5) }),
  z.object({ id: z.string().uuid(), enabled: z.boolean() }),
  z.object({ retire: z.string().uuid() }),
  z.object({ test: z.string().uuid(), prospectId: z.string().uuid() }),
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "agents-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const [agents, runs] = await Promise.all([
    db.from("agents").select("id, name, owner_id, trigger, actions, enabled, created_at").is("retired_at", null).order("created_at", { ascending: false }).limit(100),
    db.from("agent_runs").select("id, agent_id, prospect_id, test, ok, skipped, results, created_at").order("id", { ascending: false }).limit(100),
  ]);
  if (agents.error || runs.error) {
    console.error(`[agents] read failed company=${ctx.companyId}: ${(agents.error ?? runs.error)?.message}`);
    return NextResponse.json({ error: "Couldn't load agents." }, { status: 500 });
  }
  return NextResponse.json({ agents: agents.data ?? [], runs: runs.data ?? [] });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "agents-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const db = callerScopedDb(req) ?? (await createClient());
  if ("name" in body) {
    if (body.trigger.kind === "tracker_heard") {
      const { data: t } = await db.from("keyword_trackers").select("id").eq("id", body.trigger.tracker_id).maybeSingle();
      if (!t) return NextResponse.json({ error: "Pick one of your company's trackers." }, { status: 400 });
    }
    const { data, error } = await db.from("agents").insert({ company_id: ctx.companyId, owner_id: ctx.userId, name: body.name, trigger: body.trigger, actions: body.actions }).select("id").single();
    if (error || !data) {
      if (error?.code === "42501") return NextResponse.json({ error: "Only a manager or admin can make agents." }, { status: 403 });
      if (error?.code === "23514") return NextResponse.json({ error: "Give the trigger a stage or status, and each to-do a title." }, { status: 400 });
      console.error(`[agents] create failed company=${ctx.companyId}: ${error?.message}`);
      return NextResponse.json({ error: "Couldn't save the agent." }, { status: 500 });
    }
    return NextResponse.json({ id: String(data.id) });
  }
  if ("enabled" in body || "retire" in body) {
    const id = "retire" in body ? body.retire : body.id;
    const patch = "retire" in body ? { retired_at: new Date().toISOString() } : { enabled: body.enabled };
    const { data, error } = await db.from("agents").update(patch).eq("id", id).is("retired_at", null).select("id");
    if (error) return NextResponse.json({ error: "Couldn't change that agent." }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  // A test run: the agent (read through the caller's client, so only one they may see) on one deal, changing nothing.
  const { data: a } = await db.from("agents").select("id, company_id, owner_id, name, trigger, actions").eq("id", body.test).is("retired_at", null).maybeSingle();
  if (!a) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  const r = await runAgent(createAdminClient(), { ...(a as { id: string; company_id: string; owner_id: string; name: string }), trigger: a.trigger as Trigger, actions: a.actions as Action[] }, body.prospectId, true);
  return NextResponse.json(r);
}
