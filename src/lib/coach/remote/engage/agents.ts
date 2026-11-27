import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDealCalls } from "../revenue/dealCalls";
import { writeDealBrief } from "../revenue/dealBriefRun";
import { hiddenFrom } from "../hidePhrases";
import { webhooksConfigured } from "../webhooks";

/**
 * Agents (Engage plan E5, 0379; Gong M27 F27.3–F27.6). One trigger — a deal reaching a stage (by status, by stage name,
 * or both) — and up to five actions in order: write the deal brief, notify the deal's rep or the owner, add a to-do on
 * the deal, send an 'agent.ran' webhook. An agent acts on a deal only if its owner could see it (rss_agent_can_see),
 * and reads only the calls its owner may hear (hidden calls are left out for them). Every run is recorded.
 */
export type Trigger =
  | { kind: "deal_stage"; status?: "open" | "won" | "lost"; label?: string }
  | { kind: "tracker_heard"; tracker_id: string }
  // 0382: an open deal's expected close date is `days` away (run by the nightly job, once per deal and close date).
  | { kind: "close_date_near"; days: number }
  // 0389 (E8): dealRisk raises gone_quiet on an open deal (nightly, once per deal per quiet spell).
  | { kind: "deal_gone_quiet" }
  // 0390 (E11): an open deal's next call is booked for the company's tomorrow (nightly, once per deal and date).
  | { kind: "next_call_tomorrow" };
export type Action = { kind: "brief" } | { kind: "notify"; to: "rep" | "owner" } | { kind: "todo"; title: string; due_days?: number } | { kind: "webhook" };
export type StageEvent = { companyId: string; prospectId: string; status: string; label: string | null };

/** Whether a stage change fires the trigger: every part the trigger names must match (stage names ignore case). Pure. */
export function triggerMatches(t: Trigger, e: { status: string; label: string | null }): boolean {
  if (t.kind !== "deal_stage") return false;

  if (!t.status && !t.label) return false;
  if (t.status && t.status !== e.status) return false;
  if (t.label && (e.label ?? "").trim().toLowerCase() !== t.label.trim().toLowerCase()) return false;
  return true;
}

/** Whether a stage save is a change (status, or stage name ignoring case and spaces); no earlier stage counts as one. Pure. */
export function stageChanged(before: { status: string; stage_label: string | null } | null, next: { status: string; label: string | null }): boolean {
  if (!before) return true;
  const norm = (x: string | null) => (x ?? "").trim().toLowerCase();
  return before.status !== next.status || norm(before.stage_label) !== norm(next.label);
}

export type AgentRow = { id: string; company_id: string; owner_id: string; name: string; trigger: Trigger; actions: Action[] };
type ActionResult = { kind: Action["kind"]; ok: boolean; detail: string };

/** Run every enabled agent whose trigger this stage change fires. Never throws: a failure is recorded on the run. */
export async function runAgentsForStage(admin: SupabaseClient, e: StageEvent): Promise<void> {
  const { data: agents, error } = await admin.from("agents").select("id, company_id, owner_id, name, trigger, actions").eq("company_id", e.companyId).eq("enabled", true).is("retired_at", null).limit(100);
  if (error) {
    console.error(`[agents] read failed company=${e.companyId}: ${error.message}`);
    return;
  }
  for (const a of (agents ?? []) as AgentRow[]) {
    if (!triggerMatches(a.trigger, e)) continue;
    await runAgent(admin, a, e.prospectId, false);
  }
}

/**
 * 0380: a tracker first heard on a call — run the agents watching that tracker, on the deal the call belongs to (a call
 * on no deal fires nothing). `trackerIds` are the trackers heard for the first time on this call (any transcript
 * version), so a rescan never fires twice. Never throws.
 */
export async function runAgentsForTrackers(admin: SupabaseClient, e: { companyId: string; sessionId: string; trackerIds: string[] }): Promise<void> {
  if (!e.trackerIds.length) return;
  const { data: link, error: lErr } = await admin.from("remote_prospect_calls").select("prospect_id").eq("company_id", e.companyId).eq("session_id", e.sessionId).maybeSingle();
  if (lErr || !link) return;
  const { data: agents, error } = await admin.from("agents").select("id, company_id, owner_id, name, trigger, actions").eq("company_id", e.companyId).eq("enabled", true).is("retired_at", null).limit(100);
  if (error) {
    console.error(`[agents] read failed company=${e.companyId}: ${error.message}`);
    return;
  }
  const watching = ((agents ?? []) as AgentRow[]).filter((a) => a.trigger.kind === "tracker_heard" && e.trackerIds.includes(a.trigger.tracker_id));
  if (!watching.length) return;
  // Once per call and tracker (0381's unique index is the backstop for two scans racing): a rescan of the same version
  // finds no earlier version's hit, so firstHeard alone would fire again.
  const { data: done, error: rErr } = await admin.from("agent_runs").select("agent_id, tracker_id").eq("company_id", e.companyId).eq("session_id", e.sessionId).eq("test", false).limit(1000);
  if (rErr) {
    console.error(`[agents] runs read failed session=${e.sessionId}: ${rErr.message}`);
    return;
  }
  const fired = new Set(((done ?? []) as Array<{ agent_id: string; tracker_id: string | null }>).map((r) => `${r.agent_id}:${r.tracker_id}`));
  for (const a of watching) {
    const trackerId = (a.trigger as { tracker_id: string }).tracker_id;
    if (fired.has(`${a.id}:${trackerId}`)) continue;
    // A call hidden from the agent's owner never fires their agent (the owner couldn't hear it; 0337's rule).
    let hidden: Set<string>;
    try {
      hidden = await hiddenFrom(admin, [e.sessionId], a.owner_id);
    } catch {
      console.error(`[agents] hidden check failed session=${e.sessionId} agent=${a.id}`);
      continue;
    }
    if (hidden.has(e.sessionId)) continue;
    await runAgent(admin, a, String(link.prospect_id), false, { sessionId: e.sessionId, trackerId });
  }
}

/**
 * What the tracker scanners call after storing hits: agents for the trackers heard for the first time on this call.
 * NEVER throws — an agent problem must not fail the scan that stored the hits (logged instead).
 */
export async function fireTrackerAgents(admin: SupabaseClient, e: { companyId: string; sessionId: string; version: number; heard: string[] }): Promise<void> {
  try {
    const first = await firstHeard(admin, e.companyId, e.sessionId, e.version, e.heard);
    await runAgentsForTrackers(admin, { companyId: e.companyId, sessionId: e.sessionId, trackerIds: first });
  } catch (err) {
    console.error(`[agents] tracker trigger failed session=${e.sessionId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** The trackers in `heard` that this call had no hit for in any earlier transcript version: heard for the first time. */
export async function firstHeard(admin: SupabaseClient, companyId: string, sessionId: string, version: number, heard: string[]): Promise<string[]> {
  const ids = [...new Set(heard)];
  if (!ids.length) return [];
  const { data, error } = await admin.from("tracker_hits").select("tracker_id").eq("company_id", companyId).eq("session_id", sessionId).lt("transcript_version", version).in("tracker_id", ids).limit(1000);
  if (error) return [];
  const before = new Set(((data ?? []) as Array<{ tracker_id: string }>).map((r) => String(r.tracker_id)));
  return ids.filter((id) => !before.has(id));
}

/** Run one agent on one deal (test = say what would happen, without doing it). Returns the recorded result. */
/**
 * `on.claim` (0383, the nightly job's date triggers): called once the deal is read and the owner may see it, right before
 * any action. It returns false when another run already claimed this fire — then nothing is done or recorded. A failure
 * before the claim (a read) is recorded WITHOUT the fire key, so it doesn't use up the fire and the next night retries.
 */
export async function runAgent(admin: SupabaseClient, a: AgentRow, prospectId: string, test: boolean, on?: { sessionId?: string; trackerId?: string; fireKey?: string; claim?: () => Promise<boolean> }): Promise<{ ok: boolean; skipped: string | null; results: ActionResult[]; acted?: boolean }> {
  let claimed = false;
  const record = async (ok: boolean, skipped: string | null, results: ActionResult[]) => {
    const { error } = await admin.from("agent_runs").insert({ agent_id: a.id, company_id: a.company_id, prospect_id: prospectId, test, ok, skipped, results, session_id: on?.sessionId ?? null, tracker_id: on?.trackerId ?? null, ...(on?.fireKey && claimed ? { fire_key: on.fireKey } : {}) });
    if (error) console.error(`[agents] run not recorded agent=${a.id}: ${error.message}`);
    return { ok, skipped, results, acted: claimed };
  };
  const { data: deal, error: dErr } = await admin.from("remote_prospects_current").select("id, name, rep_id, status, stage_label").eq("company_id", a.company_id).eq("id", prospectId).maybeSingle();
  if (dErr) return record(false, "Couldn't read the deal.", []);
  if (!deal) return record(false, "The deal isn't in this company.", []);
  const { data: canSee, error: sErr } = await admin.rpc("rss_agent_can_see", { p_owner: a.owner_id, p_rep: deal.rep_id });
  if (sErr) return record(false, "Couldn't check who the agent acts for.", []);
  if (canSee !== true) return record(false, "The agent's owner can't see this deal, so it didn't act.", []);
  if (on?.claim && !test) {
    if (!(await on.claim())) return { ok: true, skipped: "Already done by another run.", results: [], acted: false };
    claimed = true;
  }
  const results: ActionResult[] = [];
  for (const act of a.actions) {
    if (test) {
      results.push({ kind: act.kind, ok: true, detail: act.kind === "brief" ? "Would write the deal brief." : act.kind === "notify" ? `Would notify the ${act.to === "rep" ? "deal's rep" : "agent's owner"}.` : act.kind === "todo" ? `Would add the to-do “${act.title}”.` : "Would send an agent.ran webhook." });
      continue;
    }
    try {
      results.push(await doAction(admin, a, deal as { id: string; name: string | null; rep_id: string; status: string; stage_label: string | null }, act));
    } catch (err) {
      console.error(`[agents] action ${act.kind} failed agent=${a.id}: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ kind: act.kind, ok: false, detail: "Failed." });
    }
  }
  return record(results.every((r) => r.ok), null, results);
}

async function doAction(admin: SupabaseClient, a: AgentRow, deal: { id: string; name: string | null; rep_id: string; status: string; stage_label: string | null }, act: Action): Promise<ActionResult> {
  if (act.kind === "brief") {
    const dc = await loadDealCalls(admin, deal.id);
    if (dc === "failed") return { kind: "brief", ok: false, detail: "Couldn't read the deal's calls." };
    // Only the calls the owner may hear (a hide exempts the call's people and admins, 0337).
    const hidden = await hiddenFrom(admin, dc.calls.map((c) => c.sessionId), a.owner_id);
    const calls = dc.calls.filter((c) => !hidden.has(c.sessionId));
    if (!calls.length) return { kind: "brief", ok: true, detail: "No call transcripts yet; nothing to brief." };
    const r = await writeDealBrief(admin, { companyId: a.company_id, prospectId: deal.id, actorId: a.owner_id, aiCompanyId: a.company_id, calls });
    if (r === "suppressed") return { kind: "brief", ok: true, detail: "The AI is off for this company; no brief written." };
    if (typeof r === "string") return { kind: "brief", ok: false, detail: "The brief couldn't be written." };
    return { kind: "brief", ok: true, detail: r.stored ? "The brief for these calls already existed." : "Wrote the deal brief." };
  }
  if (act.kind === "notify") {
    const to = act.to === "rep" ? deal.rep_id : a.owner_id;
    const { error } = await admin.from("manager_notifications").insert({
      company_id: a.company_id, recipient_id: to, agent_id: deal.rep_id, session_id: null, type: "agent_ran",
      // No deal name (0381): a customer's name erasure can't reach in a payload; the id opens the deal.
      payload: { agent_name: a.name, deal_id: deal.id, stage: deal.stage_label, status: deal.status },
    });
    return error ? { kind: "notify", ok: false, detail: "Couldn't send the notification." } : { kind: "notify", ok: true, detail: `Notified the ${act.to === "rep" ? "deal's rep" : "owner"}.` };
  }
  if (act.kind === "todo") {
    const due = act.due_days ? new Date(Date.now() + act.due_days * 86_400_000).toISOString().slice(0, 10) : null;
    const { data: rep } = await admin.from("profiles").select("full_name").eq("company_id", a.company_id).eq("id", deal.rep_id).maybeSingle();
    const { data: task, error } = await admin.from("tasks").insert({
      company_id: a.company_id, title: act.title.slice(0, 200),
      description: `Added by the agent “${a.name}” for ${deal.name ?? "a deal"}.\nDeal: /dashboard/remote-sales/pipeline?p=${deal.id}`,
      status: "To Do", priority: "Medium", due_date: due, assignee: (rep?.full_name as string | null) ?? null, assignee_user_id: deal.rep_id,
    }).select("id").single();
    if (error || !task) return { kind: "todo", ok: false, detail: "Couldn't add the to-do." };
    const { error: lErr } = await admin.from("remote_prospect_tasks").insert({ prospect_id: deal.id, task_id: task.id, company_id: a.company_id, created_by: a.owner_id });
    return lErr ? { kind: "todo", ok: false, detail: "The task was made but couldn't be put on the deal." } : { kind: "todo", ok: true, detail: `Added the to-do “${act.title}”.` };
  }
  const { data: eps, error: eErr } = await admin.from("webhook_endpoints").select("id").eq("company_id", a.company_id).eq("active", true).contains("events", ["agent.ran"]);
  if (eErr) return { kind: "webhook", ok: false, detail: "Couldn't read the webhooks." };
  const rows = ((eps ?? []) as Array<{ id: string }>).map((ep) => ({ company_id: a.company_id, endpoint_id: ep.id, event: "agent.ran", payload: { agent: { id: a.id, name: a.name }, deal: { id: deal.id, status: deal.status, stage: deal.stage_label } } }));
  if (!rows.length) return { kind: "webhook", ok: true, detail: "No webhook listens for agent.ran." };
  const { error } = await admin.from("webhook_deliveries").insert(rows);
  if (error) return { kind: "webhook", ok: false, detail: "Couldn't queue the webhook." };
  const queued = `Queued ${rows.length} webhook${rows.length === 1 ? "" : "s"}`;
  // Fail loud (§1.5.3): without the signing secret the sender sends nothing, so the run says so rather than "queued".
  return webhooksConfigured()
    ? { kind: "webhook", ok: true, detail: `${queued}.` }
    : { kind: "webhook", ok: false, detail: `${queued}, but webhook sending isn't switched on on this server yet (RSS_WEBHOOK_SIGNING_SECRET), so nothing is sent.` };
}
