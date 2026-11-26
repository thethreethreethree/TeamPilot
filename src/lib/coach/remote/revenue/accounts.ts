import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { rankOf, type Rank } from "./rank";
import { activityLevel, activityScore, type Level } from "./activity";

/**
 * Accounts and contacts (revenue Phase 1, 0370; Gong M21). Every read here goes through the CALLER's client, so 0370's
 * RLS decides what exists for them: an account they can't see is absent, never an error that confirms it exists.
 * A failed read throws (AccountReadError): the routes turn it into a 500, never into an empty list (noFailedReadAsEmpty).
 */
export class AccountReadError extends Error {}

export type AccountRow = {
  id: string;
  name: string;
  createdAt: string;
  openDeals: number;
  openAmount: number;
  wonDeals: number;
  lostDeals: number;
  lastCallAt: string | null;
  contacts: number;
  reps: string[];
  /** Revenue Phase 4 (0375; Gong F21.4): engagement over the last 90 days, from two-way calls. */
  activity: { level: Level; score: number; calls90: number };
};

export type ContactRow = { id: string; name: string; title: string | null; rank: Rank; accountId: string | null; email?: string | null; phone?: string | null };

const CAP = 1000;

type ProspectLite = { id: string; rep_id: string; account_id: string | null; status: string; amount: number | null; last_call_at: string | null; name: string | null; stage_label: string | null; close_date: string | null; created_at: string };

async function visibleProspects(db: SupabaseClient, scope: { repId?: string } = {}): Promise<ProspectLite[]> {
  let q = db
    .from("remote_prospects_current")
    .select("id, rep_id, account_id, status, amount, last_call_at, name, stage_label, close_date, created_at")
    .not("account_id", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CAP);
  if (scope.repId) q = q.eq("rep_id", scope.repId);
  const { data, error } = await q;
  if (error) throw new AccountReadError(`prospects: ${error.message}`);
  return (data ?? []) as ProspectLite[];
}

/**
 * The accounts list. scope "team": every account the caller can see (a manager's tree). "mine" / a rep id: accounts
 * with at least one deal of that rep, plus (for "mine") accounts the caller made that have no deal yet.
 */
export async function listAccounts(db: SupabaseClient, me: string, scope: "mine" | "team" | string, search?: string): Promise<{ accounts: AccountRow[]; capped: boolean }> {
  const repId = scope === "team" ? undefined : scope === "mine" ? me : scope;
  const deals = await visibleProspects(db, { repId });
  let aq = db.from("accounts_current").select("id, name, created_at, created_by").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(CAP);
  if (search?.trim()) aq = aq.ilike("name", `%${search.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data: accs, error } = await aq;
  if (error) throw new AccountReadError(`accounts: ${error.message}`);
  const onDeals = new Set(deals.map((d) => d.account_id as string));
  const rows = ((accs ?? []) as Array<{ id: string; name: string | null; created_at: string; created_by: string }>).filter(
    (a) => scope === "team" || onDeals.has(a.id) || (scope === "mine" && a.created_by === me),
  );
  const ids = rows.map((a) => a.id);
  const contactCount = new Map<string, number>();
  if (ids.length) {
    // Every contact counted, paged past the 1000-row cap; a failed page throws rather than undercount.
    let cs: Array<{ account_id: string }>;
    try {
      cs = await fetchAllPaged<{ account_id: string }>(
        (from, to) => db.from("contacts_current").select("id, account_id").in("account_id", ids).order("id").range(from, to),
        { label: "account contacts" },
      );
    } catch (e) {
      throw new AccountReadError(e instanceof Error ? e.message : String(e));
    }
    for (const c of cs) contactCount.set(c.account_id, (contactCount.get(c.account_id) ?? 0) + 1);
  }
  // Two-way calls per account in the last year (rss_account_activity, as the caller), in chunks; a failed read throws.
  const callsOf = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data: act, error: actErr } = await db.rpc("rss_account_activity", { p_accounts: ids.slice(i, i + 150) });
    if (actErr) throw new AccountReadError(`activity: ${actErr.message}`);
    for (const x of (act ?? []) as Array<{ account_id: string; call_at: string }>) callsOf.set(x.account_id, [...(callsOf.get(x.account_id) ?? []), x.call_at]);
  }
  const todayIso = new Date().toISOString();
  const accounts = rows.map((a) => {
    const mine = deals.filter((d) => d.account_id === a.id);
    const open = mine.filter((d) => d.status === "open");
    const lastCall = mine.map((d) => d.last_call_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
    return {
      id: a.id,
      name: a.name ?? "(no name)",
      createdAt: a.created_at,
      openDeals: open.length,
      openAmount: open.reduce((s, d) => s + Number(d.amount ?? 0), 0),
      wonDeals: mine.filter((d) => d.status === "won").length,
      lostDeals: mine.filter((d) => d.status === "lost").length,
      lastCallAt: lastCall,
      contacts: contactCount.get(a.id) ?? 0,
      reps: [...new Set(mine.map((d) => d.rep_id))],
      activity: (() => {
        const calls = callsOf.get(a.id) ?? [];
        const score = activityScore(calls, todayIso, 90);
        return { level: activityLevel(score), score, calls90: calls.filter((c) => Date.parse(todayIso) - Date.parse(c) < 90 * 86_400_000).length };
      })(),
    };
  });
  accounts.sort((x, y) => (y.lastCallAt ?? y.createdAt).localeCompare(x.lastCallAt ?? x.createdAt));
  return { accounts, capped: (accs ?? []).length >= CAP || deals.length >= CAP };
}

export type TimelineItem =
  | { kind: "call"; at: string; sessionId: string; label: string | null; channel: string | null; dealId: string | null }
  | { kind: "deal"; at: string; dealId: string; what: string; value: unknown }
  | { kind: "task"; at: string; dealId: string; taskId: string; title: string; done: boolean };

/** One account: its deals, contacts, and one timeline of calls, deal changes and to-dos, newest first (Gong F21.3). */
export async function accountDetail(db: SupabaseClient, accountId: string) {
  const { data: acc, error } = await db.from("accounts_current").select("id, name, created_at").eq("id", accountId).maybeSingle();
  if (error) throw new AccountReadError(`account: ${error.message}`);
  if (!acc) return null;
  const { data: ds, error: dErr } = await db
    .from("remote_prospects_current")
    .select("id, rep_id, name, status, stage_label, amount, close_date, last_call_at, next_call_date, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (dErr) throw new AccountReadError(`deals: ${dErr.message}`);
  const deals = (ds ?? []) as Array<Record<string, unknown> & { id: string; rep_id: string }>;
  const dealIds = deals.map((d) => d.id);
  const contacts = await contactsOfAccount(db, accountId);
  const timeline: TimelineItem[] = [];
  if (dealIds.length) {
    const [calls, evs, links] = await Promise.all([
      db.from("remote_prospect_calls").select("prospect_id, session_id").in("prospect_id", dealIds).order("id").limit(1000),
      db.from("remote_prospect_events").select("prospect_id, kind, value, created_at").in("prospect_id", dealIds).in("kind", ["stage", "amount", "close_date", "next_call"]).order("id", { ascending: false }).limit(500),
      db.from("remote_prospect_tasks").select("prospect_id, task_id").in("prospect_id", dealIds).order("id").limit(1000),
    ]);
    if (calls.error || evs.error || links.error) throw new AccountReadError(`timeline: ${(calls.error ?? evs.error ?? links.error)?.message}`);
    const callRows = (calls.data ?? []) as Array<{ prospect_id: string; session_id: string }>;
    const dealOfCall = new Map(callRows.map((c) => [c.session_id, c.prospect_id]));
    const sessionIds = callRows.map((c) => c.session_id);
    const taskRows = (links.data ?? []) as Array<{ prospect_id: string; task_id: string }>;
    const [sess, tasks] = await Promise.all([
      sessionIds.length ? db.from("coaching_sessions").select("id, client_label, context, started_at").in("id", sessionIds) : Promise.resolve({ data: [], error: null }),
      taskRows.length ? db.from("tasks").select("id, title, status, created_at").in("id", taskRows.map((t) => t.task_id)).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
    ]);
    if (sess.error || tasks.error) throw new AccountReadError(`timeline detail: ${(sess.error ?? tasks.error)?.message}`);
    for (const s of (sess.data ?? []) as Array<{ id: string; client_label: string | null; context: string | null; started_at: string }>) {
      timeline.push({ kind: "call", at: s.started_at, sessionId: s.id, label: s.client_label, channel: s.context, dealId: dealOfCall.get(s.id) ?? null });
    }
    for (const e of (evs.data ?? []) as Array<{ prospect_id: string; kind: string; value: unknown; created_at: string }>) {
      timeline.push({ kind: "deal", at: e.created_at, dealId: e.prospect_id, what: e.kind, value: e.value });
    }
    const dealOfTask = new Map(taskRows.map((t) => [t.task_id, t.prospect_id]));
    for (const t of (tasks.data ?? []) as Array<{ id: string; title: string; status: string | null; created_at: string }>) {
      timeline.push({ kind: "task", at: t.created_at, dealId: dealOfTask.get(t.id) ?? "", taskId: t.id, title: t.title, done: /done|closed|complete/i.test(t.status ?? "") });
    }
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at));
  return { account: { id: acc.id as string, name: (acc.name as string | null) ?? "(no name)", createdAt: acc.created_at as string }, deals, contacts, timeline: timeline.slice(0, 300) };
}

function toContact(c: { id: string; name: string | null; title: string | null; account_id: string | null; email?: string | null; phone?: string | null }): ContactRow {
  return { id: c.id, name: c.name ?? "(no name)", title: c.title, rank: rankOf(c.title), accountId: c.account_id, email: c.email ?? null, phone: c.phone ?? null };
}

export async function contactsOfAccount(db: SupabaseClient, accountId: string): Promise<ContactRow[]> {
  const { data, error } = await db.from("contacts_current").select("id, name, title, account_id, email, phone").eq("account_id", accountId).order("name").order("id").limit(500);
  if (error) throw new AccountReadError(`contacts: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; name: string | null; title: string | null; account_id: string | null }>).map(toContact);
}

export type DealContact = ContactRow & { role: string };

/** A deal's current contacts (the latest row per contact, minus removed ones). */
export async function contactsOfDeal(db: SupabaseClient, prospectId: string): Promise<DealContact[]> {
  const { data: links, error } = await db.from("deal_contacts_current").select("contact_id, role").eq("prospect_id", prospectId).neq("role", "removed").order("contact_id").limit(200);
  if (error) throw new AccountReadError(`deal contacts: ${error.message}`);
  const rows = (links ?? []) as Array<{ contact_id: string; role: string }>;
  if (!rows.length) return [];
  const { data: cs, error: cErr } = await db.from("contacts_current").select("id, name, title, account_id, email, phone").in("id", rows.map((r) => r.contact_id));
  if (cErr) throw new AccountReadError(`contacts: ${cErr.message}`);
  const role = new Map(rows.map((r) => [r.contact_id, r.role]));
  return ((cs ?? []) as Array<{ id: string; name: string | null; title: string | null; account_id: string | null; email: string | null; phone: string | null }>)
    .map((c) => ({ ...toContact(c), role: role.get(c.id) ?? "other" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The contacts linked to a call (latest row per contact, linked only). */
export async function contactsOfCall(db: SupabaseClient, sessionId: string): Promise<ContactRow[]> {
  const { data: links, error } = await db.from("call_contacts_current").select("contact_id, linked").eq("session_id", sessionId).eq("linked", true).order("contact_id").limit(50);
  if (error) throw new AccountReadError(`call contacts: ${error.message}`);
  const ids = ((links ?? []) as Array<{ contact_id: string }>).map((l) => l.contact_id);
  if (!ids.length) return [];
  const { data: cs, error: cErr } = await db.from("contacts_current").select("id, name, title, account_id").in("id", ids);
  if (cErr) throw new AccountReadError(`contacts: ${cErr.message}`);
  return ((cs ?? []) as Array<{ id: string; name: string | null; title: string | null; account_id: string | null }>).map(toContact);
}

export const DEAL_ROLES = ["decision_maker", "champion", "user", "other"] as const;
export type DealRole = (typeof DEAL_ROLES)[number];
export const ROLE_LABEL: Record<DealRole, string> = { decision_maker: "Decision maker", champion: "Champion", user: "User", other: "Other" };
