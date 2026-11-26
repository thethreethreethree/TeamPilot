import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { dealRisk } from "../dealRisk";
import { listProspects, type ProspectRow } from "../prospects";
import { runAgent, type AgentRow } from "../engage/agents";

/**
 * The nightly revenue job (0382; revenue plan Phase 3a "nightly" warnings and Phase 4 drivers over 30 / 90 days; Engage
 * plan E5 "close date near"). For each company, as the service role through the company-pinned pipeline reader
 * (listProspects with companyId — RLS doesn't apply here, so every read is pinned):
 *   1. every open deal's warnings today, as dealRisk judges them (the one verdict, §2.2), kept once per deal per day;
 *   2. the company's 'close_date_near' agents, on each open deal whose expected close date is within their window —
 *      once per deal and close date (agent_runs.fire_key), so a missed night still fires and a seen deal never twice.
 * Runs only from the cron route (CRON_SECRET). A company whose read fails is counted and skipped, never half-written.
 */
export type DailyResult = { companies: number; snapshots: number; failedCompanies: number; fired: number; lookupFailed?: boolean };

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Today's warning rows for a company's open deals. Pure. */
export function snapshotRows(companyId: string, day: string, deals: ProspectRow[]) {
  return deals
    .filter((d) => d.status === "open")
    .map((d) => {
      const r = dealRisk(d, day);
      return { company_id: companyId, day, prospect_id: d.id, rep_id: d.repId, level: r.level, reasons: r.reasons };
    });
}

/** The fire key of a close-date run: the deal, its close date and the agent's window. */
export const closeFireKey = (prospectId: string, closeDate: string, days: number) => `close:${prospectId}:${closeDate}:${days}`;

/**
 * Which close-date agents fire on which open deals today: the close date is between today and `days` from now. Pure.
 * Fires already recorded (`fired`, by fire key) are left out.
 */
export function closeDateFires(agents: AgentRow[], deals: ProspectRow[], day: string, fired: Set<string>): Array<{ agent: AgentRow; prospectId: string; fireKey: string }> {
  const out: Array<{ agent: AgentRow; prospectId: string; fireKey: string }> = [];
  for (const a of agents) {
    if (a.trigger.kind !== "close_date_near") continue;
    const until = addDays(day, a.trigger.days);
    for (const d of deals) {
      if (d.status !== "open" || !d.closeDate || d.closeDate < day || d.closeDate > until) continue;
      const fireKey = closeFireKey(d.id, d.closeDate, a.trigger.days);
      if (!fired.has(`${a.id}|${fireKey}`)) out.push({ agent: a, prospectId: d.id, fireKey });
    }
  }
  return out;
}

export async function runRevenueDaily(admin: SupabaseClient, day: string): Promise<DailyResult> {
  const res: DailyResult = { companies: 0, snapshots: 0, failedCompanies: 0, fired: 0 };
  const { data: cos, error } = await fetchAllPagedResult<{ id: string }>((f, t) => admin.from("companies").select("id").order("id").range(f, t), { label: "companies" });
  if (error) return { ...res, lookupFailed: true };
  for (const { id: companyId } of cos ?? []) {
    const deals = await listProspects(admin, undefined, { companyId, sentiment: true });
    if (deals === null) {
      res.failedCompanies += 1;
      continue;
    }
    if (!deals.length) continue;
    res.companies += 1;
    const written = await writeSnapshots(admin, companyId, day, snapshotRows(companyId, day, deals));
    if (written === null) {
      res.failedCompanies += 1;
      continue;
    }
    res.snapshots += written;
    res.fired += await fireCloseDateAgents(admin, companyId, deals, day);
  }
  return res;
}

/**
 * Once per deal per day: a second run the same day keeps the first. The table's append-only rule makes Postgres refuse
 * any ON CONFLICT insert (upsert), so the rows already stored for the day are read first and only the rest inserted; a
 * duplicate from a run racing this one (23505) means "already there", and that chunk is retried row by row.
 * Returns how many were written, or null on a failed read or write.
 */
async function writeSnapshots(admin: SupabaseClient, companyId: string, day: string, rows: ReturnType<typeof snapshotRows>): Promise<number | null> {
  const { data: have, error } = await fetchAllPagedResult<{ id: number; prospect_id: string }>(
    (f, t) => admin.from("deal_warning_snapshots").select("id, prospect_id").eq("company_id", companyId).eq("day", day).order("id").range(f, t),
    { label: "today's snapshots" },
  );
  if (error) {
    console.error(`[revenue-daily] snapshots read failed company=${companyId}: ${error.message}`);
    return null;
  }
  const stored = new Set((have ?? []).map((r) => String(r.prospect_id)));
  const todo = rows.filter((r) => !stored.has(r.prospect_id));
  let n = 0;
  for (let i = 0; i < todo.length; i += 500) {
    const chunk = todo.slice(i, i + 500);
    const { error: iErr } = await admin.from("deal_warning_snapshots").insert(chunk);
    if (!iErr) {
      n += chunk.length;
      continue;
    }
    if (iErr.code !== "23505") {
      console.error(`[revenue-daily] snapshots failed company=${companyId}: ${iErr.message}`);
      return null;
    }
    for (const row of chunk) {
      const { error: rErr } = await admin.from("deal_warning_snapshots").insert(row);
      if (!rErr) n += 1;
      else if (rErr.code !== "23505") {
        console.error(`[revenue-daily] snapshot failed company=${companyId}: ${rErr.message}`);
        return null;
      }
    }
  }
  return n;
}

async function fireCloseDateAgents(admin: SupabaseClient, companyId: string, deals: ProspectRow[], day: string): Promise<number> {
  const { data: agents, error } = await admin.from("agents").select("id, company_id, owner_id, name, trigger, actions").eq("company_id", companyId).eq("enabled", true).is("retired_at", null).limit(100);
  if (error) {
    console.error(`[revenue-daily] agents read failed company=${companyId}: ${error.message}`);
    return 0;
  }
  const dateAgents = ((agents ?? []) as AgentRow[]).filter((a) => a.trigger.kind === "close_date_near");
  if (!dateAgents.length) return 0;
  // What already fired (the unique index is the backstop; this read keeps the actions themselves from running twice).
  const { data: runs, error: rErr } = await fetchAllPagedResult<{ id: number; agent_id: string; fire_key: string }>(
    (f, t) => admin.from("agent_runs").select("id, agent_id, fire_key").eq("company_id", companyId).eq("test", false).in("agent_id", dateAgents.map((a) => a.id)).like("fire_key", "close:%").order("id").range(f, t),
    { label: "agent runs" },
  );
  if (rErr) {
    console.error(`[revenue-daily] runs read failed company=${companyId}: ${rErr.message}`);
    return 0;
  }
  const fired = new Set((runs ?? []).map((r) => `${r.agent_id}|${r.fire_key}`));
  let n = 0;
  for (const f of closeDateFires(dateAgents, deals, day, fired)) {
    await runAgent(admin, f.agent, f.prospectId, false, { fireKey: f.fireKey });
    n += 1;
  }
  return n;
}
