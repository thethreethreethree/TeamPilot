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
  // Every group, retired ones too (review 2026-11-27): editing a group retires the old row, and a retired row is still
  // stored text the company can read.
  const groups = await fetchAllPagedResult<{ id: string; members: string[] }>((f, t) => admin.from("market_topic_groups").select("id, members").eq("company_id", companyId).order("id").range(f, t), { label: "topic groups" });
  if (groups.error) return null;
  const all = (groups.data ?? []).map((g) => ({ id: String(g.id), members: g.members ?? [] }));
  if (!all.length) return { groups: [], members: [] };
  const memberKeys = new Set(all.flatMap((g) => g.members.filter((m) => m !== "[erased]").map(topicKey)).filter(Boolean));

  // 1. The erased calls' own topics: only a group member they mention can qualify. Usually none — then nothing else is read.
  const erased = new Set(erasedSessionIds);
  const appearsOn = new Map<string, Set<string>>();
  const note = (k: string, sid: string) => {
    if (!appearsOn.has(k)) appearsOn.set(k, new Set());
    appearsOn.get(k)!.add(sid);
  };
  const readTopics = async (sessionIds: string[], each: (sid: string, key: string) => void): Promise<boolean> => {
    for (let i = 0; i < sessionIds.length; i += 150) {
      const subjects = sessionIds.slice(i, i + 150).map((id) => `sales_session:${id}`);
      // Only the topics, not the whole intel payload.
      const ev = await fetchAllPagedResult<{ id: string; subject: string; topics: unknown }>(
        (f, t) => admin.from("events").select("id, subject, topics:payload->intel->topics").eq("kind", "coach.session_intel_generated").in("subject", subjects).order("id").range(f, t),
        { label: "intel topics" },
      );
      if (ev.error) return false;
      for (const e of ev.data ?? []) {
        const sid = String(e.subject).slice("sales_session:".length);
        for (const t of Array.isArray(e.topics) ? e.topics : []) {
          if (typeof t !== "string") continue;
          const k = topicKey(t);
          if (k && memberKeys.has(k)) each(sid, k);
        }
      }
    }
    return true;
  };
  if (!(await readTopics([...erased], (sid, k) => note(k, sid)))) return null;
  const candidates = new Set(appearsOn.keys());
  if (!candidates.size) return { groups: [], members: [] };

  // 2. The company's other calls, for the candidates only: a candidate seen on a kept call stays. Stops once none is left.
  const sessions = await fetchAllPagedResult<{ id: string }>((f, t) => admin.from("coaching_sessions").select("id").eq("company_id", companyId).order("id").range(f, t), { label: "company calls" });
  if (sessions.error) return null;
  const kept = (sessions.data ?? []).map((x) => String(x.id)).filter((id) => !erased.has(id));
  for (let i = 0; i < kept.length && candidates.size; i += 150) {
    const ok = await readTopics(kept.slice(i, i + 150), (sid, k) => {
      if (candidates.has(k)) {
        note(k, sid);
        candidates.delete(k);
      }
    });
    if (!ok) return null;
  }
  return membersOnlyOn(all, appearsOn, erased);
}
