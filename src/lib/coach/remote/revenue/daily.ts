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
 *      once per deal and close date: a run claims the fire (0383 agent_fires) before acting, so overlapping runs never
 *      both act; a missed night still fires (the window, not an exact day).
 * Each company is dated by its own timezone.
 * Runs only from the cron route (CRON_SECRET). A company whose read fails is counted and skipped, never half-written.
 */
export type DailyResult = { companies: number; snapshots: number; failedCompanies: number; fired: number; remaining?: number; lookupFailed?: boolean };

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

/** The fire key of a gone-quiet run: the deal and its last call ("none" before the first), so a new call starts a new spell. */
export const quietFireKey = (prospectId: string, lastCallAt: string | null) => `quiet:${prospectId}:${lastCallAt ?? "none"}`;

/**
 * Which gone-quiet agents (0389) fire on which open deals today: those dealRisk judges gone_quiet — its verdict, consumed,
 * never re-derived (§2.2). Once per deal per quiet spell; fires already recorded are left out. Pure.
 */
export function quietFires(agents: AgentRow[], deals: ProspectRow[], day: string, fired: Set<string>): Array<{ agent: AgentRow; prospectId: string; fireKey: string }> {
  const quiet = deals.filter((d) => d.status === "open" && dealRisk(d, day).reasons.includes("gone_quiet"));
  const out: Array<{ agent: AgentRow; prospectId: string; fireKey: string }> = [];
  for (const a of agents) {
    if (a.trigger.kind !== "deal_gone_quiet") continue;
    for (const d of quiet) {
      const fireKey = quietFireKey(d.id, d.lastCallAt);
      if (!fired.has(`${a.id}|${fireKey}`)) out.push({ agent: a, prospectId: d.id, fireKey });
    }
  }
  return out;
}

/** The fire key of a meeting-prep run: the deal and the booked date, so a call moved to another day fires again. */
export const nextCallFireKey = (prospectId: string, date: string) => `nextcall:${prospectId}:${date}`;

/** Which meeting-prep agents (0390) fire today: open deals whose next call is the company's tomorrow. Pure. */
export function nextCallFires(agents: AgentRow[], deals: ProspectRow[], day: string, fired: Set<string>): Array<{ agent: AgentRow; prospectId: string; fireKey: string }> {
  const tomorrow = addDays(day, 1);
  const out: Array<{ agent: AgentRow; prospectId: string; fireKey: string }> = [];
  for (const a of agents) {
    if (a.trigger.kind !== "next_call_tomorrow") continue;
    for (const d of deals) {
      if (d.status !== "open" || d.nextCallDate !== tomorrow) continue;
      const fireKey = nextCallFireKey(d.id, tomorrow);
      if (!fired.has(`${a.id}|${fireKey}`)) out.push({ agent: a, prospectId: d.id, fireKey });
    }
  }
  return out;
}

/** A company's own day (its IANA timezone, 0226; UTC when unset or invalid): warnings and close dates are dated by it. */
export function dayIn(timezone: string | null | undefined, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** How long one run may keep starting companies (the route has 300 s; the rest is left for the one in flight). */
export const RUN_BUDGET_MS = 200_000;

/**
 * One run over every company, within RUN_BUDGET_MS. A company already recorded for its day is skipped, so the later
 * cron slots (vercel.json) pick up where a run that ran out of time stopped — `remaining` says how many were left. Each
 * company is its own try: one company's failure is counted and the rest still run.
 */
export async function runRevenueDaily(admin: SupabaseClient, now: Date, budgetMs = RUN_BUDGET_MS): Promise<DailyResult> {
  const started = Date.now();
  const res: DailyResult = { companies: 0, snapshots: 0, failedCompanies: 0, fired: 0, remaining: 0 };
  const { data: cos, error } = await fetchAllPagedResult<{ id: string; timezone: string | null }>((f, t) => admin.from("companies").select("id, timezone").order("id").range(f, t), { label: "companies" });
  if (error) return { ...res, lookupFailed: true };
  for (const co of cos ?? []) {
    if (Date.now() - started > budgetMs) {
      res.remaining! += 1;
      continue;
    }
    try {
      const day = dayIn(co.timezone, now);
      const { count, error: cErr } = await admin.from("deal_warning_snapshots").select("id", { count: "exact", head: true }).eq("company_id", co.id).eq("day", day);
      if (cErr) throw new Error(cErr.message);
      if ((count ?? 0) > 0) continue; // done by an earlier run today
      const deals = await listProspects(admin, undefined, { companyId: co.id, sentiment: true });
      if (deals === null) throw new Error("deals read failed");
      if (!deals.length) continue;
      res.companies += 1;
      const written = await writeSnapshots(admin, co.id, day, snapshotRows(co.id, day, deals));
      if (written === null) throw new Error("snapshots write failed");
      res.snapshots += written;
      const fired = await fireCloseDateAgents(admin, co.id, deals, day);
      if (fired === null) throw new Error("date agents failed");
      res.fired += fired;
    } catch (err) {
      console.error(`[revenue-daily] company=${co.id} failed: ${err instanceof Error ? err.message : String(err)}`);
      res.failedCompanies += 1;
    }
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

/** Runs the company's date agents (close date near; gone quiet, 0389; next call tomorrow, 0390); how many acted, or null when the agents or their claims couldn't be read. */
async function fireCloseDateAgents(admin: SupabaseClient, companyId: string, deals: ProspectRow[], day: string): Promise<number | null> {
  const { data: agents, error } = await fetchAllPagedResult<AgentRow & { created_at: string }>(
    (f, t) => admin.from("agents").select("id, company_id, owner_id, name, trigger, actions, created_at").eq("company_id", companyId).eq("enabled", true).is("retired_at", null).order("created_at").order("id").range(f, t),
    { label: "agents" },
  );
  if (error) {
    console.error(`[revenue-daily] agents read failed company=${companyId}: ${error.message}`);
    return null;
  }
  const dateAgents = (agents ?? []).filter((a) => a.trigger.kind === "close_date_near" || a.trigger.kind === "deal_gone_quiet" || a.trigger.kind === "next_call_tomorrow");
  if (!dateAgents.length) return 0;
  // Fires already claimed (0383). The claim itself is the guard; this read only saves needless work.
  const { data: claims, error: rErr } = await fetchAllPagedResult<{ agent_id: string; fire_key: string }>(
    (f, t) => admin.from("agent_fires").select("agent_id, fire_key").eq("company_id", companyId).order("agent_id").order("fire_key").range(f, t),
    { label: "agent fires" },
  );
  if (rErr) {
    console.error(`[revenue-daily] claims read failed company=${companyId}: ${rErr.message}`);
    return null;
  }
  const fired = new Set((claims ?? []).map((r) => `${r.agent_id}|${r.fire_key}`));
  let n = 0;
  for (const f of [...closeDateFires(dateAgents, deals, day, fired), ...quietFires(dateAgents, deals, day, fired), ...nextCallFires(dateAgents, deals, day, fired)]) {
    const claim = async () => {
      const { error: clErr } = await admin.from("agent_fires").insert({ agent_id: f.agent.id, fire_key: f.fireKey, company_id: companyId });
      if (!clErr) return true;
      if (clErr.code !== "23505") throw new Error(`claim failed: ${clErr.message}`);
      return false; // another run has it
    };
    const r = await runAgent(admin, f.agent, f.prospectId, false, { fireKey: f.fireKey, claim });
    if (r.acted) n += 1;
  }
  return n;
}
