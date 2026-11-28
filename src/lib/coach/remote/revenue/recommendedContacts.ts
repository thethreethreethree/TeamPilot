import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountReadError, contactsOfAccount, type ContactRow } from "./accounts";
import type { Rank } from "./rank";

/**
 * Recommended contacts (revenue plan phase 9; Gong F26.6, from our own calls — no enrichment): the people on a deal's
 * account who were linked to any of the account's calls ("Who was this?", call_contacts) but aren't on this deal.
 * Senior titles first, then how many of the account's calls they were on, then the most recent. Nothing is stored;
 * every read goes through the caller's client, so only deals, calls and contacts they may see count.
 */
export type Suggested = ContactRow & { calls: number; lastCallAt: string | null };

const RANK_ORDER: Rank[] = ["c_level", "vp", "director", "manager", "individual", "unknown"];

/** Rank the account's contacts heard on its calls, minus the deal's. Pure. */
export function rankSuggestions(accountContacts: ContactRow[], onDeal: Set<string>, heard: Map<string, { calls: number; lastCallAt: string | null }>, max = 5): Suggested[] {
  return accountContacts
    .filter((c) => !onDeal.has(c.id) && heard.has(c.id))
    .map((c) => ({ ...c, ...heard.get(c.id)! }))
    .sort((a, b) =>
      RANK_ORDER.indexOf(a.rank as Rank) - RANK_ORDER.indexOf(b.rank as Rank) ||
      b.calls - a.calls ||
      (b.lastCallAt ?? "").localeCompare(a.lastCallAt ?? "") ||
      a.name.localeCompare(b.name))
    .slice(0, max);
}

/** The deal's suggestions. Throws AccountReadError on a failed read (the route says so; never "no one to suggest"). */
export async function recommendedContacts(db: SupabaseClient, accountId: string, onDeal: Set<string>): Promise<Suggested[]> {
  const contacts = await contactsOfAccount(db, accountId);
  const candidates = contacts.filter((c) => !onDeal.has(c.id));
  if (!candidates.length) return [];
  const { data: deals, error: dErr } = await db.from("remote_prospects_current").select("id").eq("account_id", accountId).limit(200);
  if (dErr) throw new AccountReadError(`account deals: ${dErr.message}`);
  const dealIds = ((deals ?? []) as Array<{ id: string }>).map((d) => d.id);
  if (!dealIds.length) return [];
  const { data: calls, error: cErr } = await db.from("remote_prospect_calls").select("session_id").in("prospect_id", dealIds).order("id").limit(1000);
  if (cErr) throw new AccountReadError(`account calls: ${cErr.message}`);
  const sessionIds = ((calls ?? []) as Array<{ session_id: string }>).map((c) => c.session_id);
  if (!sessionIds.length) return [];
  const { data: links, error: lErr } = await db
    .from("call_contacts_current")
    .select("session_id, contact_id")
    .in("session_id", sessionIds)
    .in("contact_id", candidates.map((c) => c.id))
    .eq("linked", true)
    .limit(1000);
  if (lErr) throw new AccountReadError(`call contacts: ${lErr.message}`);
  const rows = (links ?? []) as Array<{ session_id: string; contact_id: string }>;
  if (!rows.length) return [];
  const { data: sess, error: sErr } = await db.from("coaching_sessions").select("id, started_at").in("id", [...new Set(rows.map((r) => r.session_id))]);
  if (sErr) throw new AccountReadError(`calls: ${sErr.message}`);
  const when = new Map(((sess ?? []) as Array<{ id: string; started_at: string }>).map((s) => [String(s.id), s.started_at]));
  const heard = new Map<string, { calls: number; lastCallAt: string | null }>();
  for (const r of rows) {
    // A call the caller can't open (RLS returned no session row) doesn't count.
    if (!when.has(String(r.session_id))) continue;
    const h = heard.get(r.contact_id) ?? { calls: 0, lastCallAt: null };
    const at = when.get(String(r.session_id)) ?? null;
    heard.set(r.contact_id, { calls: h.calls + 1, lastCallAt: at && (!h.lastCallAt || at > h.lastCallAt) ? at : h.lastCallAt });
  }
  return rankSuggestions(contacts, onDeal, heard);
}
