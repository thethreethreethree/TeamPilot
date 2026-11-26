import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { topicKey } from "./market";

/**
 * Legal erasure and Market topic groups (0385). A group member is a topic wording from the company's calls; one that
 * appears ONLY on the calls being erased is derived from that customer (§3.1.1(2)) and is blanked. "Appears on a call"
 * uses Market's own matcher (topicKey, §2.2) over every intel version of each call (an older wording is stored text
 * too). Read with the service role, pinned to the company: its groups and retirements by company_id, its calls by
 * company_id, and their intel events by subject (events by subject, as erasure deletes them — 0350). Null on any failed
 * read: the erasure route then stops rather than erase without this step.
 */
export type TopicErasure = { groups: string[]; members: string[] };

/** Which members appear only on `erased` calls. Pure. `appearsOn` = topicKey → the calls whose intel mentions it. */
export function membersOnlyOn(groups: Array<{ id: string; members: string[] }>, appearsOn: Map<string, Set<string>>, erased: Set<string>): TopicErasure {
  const out = { groups: new Set<string>(), members: new Set<string>() };
  for (const g of groups) {
    for (const m of g.members) {
      if (m === "[erased]") continue;
      const on = appearsOn.get(topicKey(m));
      if (on && on.size > 0 && [...on].every((s) => erased.has(s))) {
        out.groups.add(g.id);
        out.members.add(m);
      }
    }
  }
  return { groups: [...out.groups], members: [...out.members] };
}

export async function topicMembersOnlyIn(admin: SupabaseClient, companyId: string, erasedSessionIds: string[]): Promise<TopicErasure | null> {
  if (!erasedSessionIds.length) return { groups: [], members: [] };
  const [groups, retired] = await Promise.all([
    fetchAllPagedResult<{ id: string; members: string[] }>((f, t) => admin.from("market_topic_groups").select("id, members").eq("company_id", companyId).order("id").range(f, t), { label: "topic groups" }),
    fetchAllPagedResult<{ group_id: string }>((f, t) => admin.from("market_topic_group_retirements").select("group_id").eq("company_id", companyId).order("group_id").range(f, t), { label: "topic group retirements" }),
  ]);
  if (groups.error || retired.error) return null;
  const gone = new Set((retired.data ?? []).map((r) => String(r.group_id)));
  const live = (groups.data ?? []).filter((g) => !gone.has(String(g.id)));
  if (!live.length) return { groups: [], members: [] };

  const sessions = await fetchAllPagedResult<{ id: string }>((f, t) => admin.from("coaching_sessions").select("id").eq("company_id", companyId).order("id").range(f, t), { label: "company calls" });
  if (sessions.error) return null;
  const ids = (sessions.data ?? []).map((s) => String(s.id));
  const appearsOn = new Map<string, Set<string>>();
  for (let i = 0; i < ids.length; i += 150) {
    const subjects = ids.slice(i, i + 150).map((id) => `sales_session:${id}`);
    const ev = await fetchAllPagedResult<{ id: string; subject: string; payload: { intel?: { topics?: unknown } } | null }>(
      (f, t) => admin.from("events").select("id, subject, payload").eq("kind", "coach.session_intel_generated").in("subject", subjects).order("id").range(f, t),
      { label: "intel events" },
    );
    if (ev.error) return null;
    for (const e of ev.data ?? []) {
      const sid = String(e.subject).slice("sales_session:".length);
      const topics = Array.isArray(e.payload?.intel?.topics) ? (e.payload!.intel!.topics as unknown[]) : [];
      for (const t of topics) {
        if (typeof t !== "string") continue;
        const k = topicKey(t);
        if (!k) continue;
        if (!appearsOn.has(k)) appearsOn.set(k, new Set());
        appearsOn.get(k)!.add(sid);
      }
    }
  }
  return membersOnlyOn(live.map((g) => ({ id: String(g.id), members: g.members ?? [] })), appearsOn, new Set(erasedSessionIds));
}
