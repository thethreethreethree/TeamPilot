import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCallSearch, runCallSearch } from "@/lib/coach/remote/search";

/**
 * Following a saved search (0342; Gong ledger F12.7 "Streams"). Pure state from the append-only events, plus the count
 * of calls that matched since — run through the CALLER's client, so the owner's reporting tree and hidden calls
 * (0337/0341) decide what counts. The matching is never stored.
 */
export type SearchEvent = { search_id: string; kind: "follow" | "unfollow" | "seen"; created_at: string };
export type FollowState = { following: boolean; since: string | null };

/** Events newest first → per search: following (latest follow/unfollow), and since = later of that follow and last seen. */
export function followStates(events: SearchEvent[]): Map<string, FollowState> {
  const out = new Map<string, FollowState>();
  const sorted = [...events].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const toggled = new Set<string>();
  const lastSeen = new Map<string, string>();
  for (const e of sorted) {
    if (e.kind === "seen") {
      if (!lastSeen.has(e.search_id)) lastSeen.set(e.search_id, e.created_at);
      continue;
    }
    if (toggled.has(e.search_id)) continue;
    toggled.add(e.search_id);
    out.set(e.search_id, { following: e.kind === "follow", since: e.kind === "follow" ? e.created_at : null });
  }
  for (const [id, st] of out) {
    if (!st.following || !st.since) continue;
    const seen = lastSeen.get(id);
    if (seen && Date.parse(seen) > Date.parse(st.since)) st.since = seen;
  }
  return out;
}

export const NEW_CAP = 50;

/**
 * How many calls match `query` and ENDED after `since` — Remote Sales calls only, through `db` (the caller's own
 * client). "Ended", not "started" (review 2026-11-26): a call still in progress or processing when the person looked
 * is counted once it ends, instead of slipping past. The search's own date filters apply as saved. null = couldn't run
 * (never shown as 0); capped = the count is a floor (too many matches to count, or the word search hit its read cap).
 */
export async function newMatches(db: SupabaseClient, query: string, since: string): Promise<{ count: number; capped: boolean } | null> {
  const parsed = parseCallSearch(new URLSearchParams(query));
  if ("error" in parsed) return null;
  const r = await runCallSearch(db, { ...parsed.filters, endedAfter: since, remoteOnly: true });
  if (!r.ok) return null;
  return { count: Math.min(r.rows.length, NEW_CAP), capped: r.rows.length > NEW_CAP || r.truncated || r.narrower === true };
}

/**
 * Shared saved searches (0362; F12.7 "private or company"): the latest share / unshare per search decides whether it is
 * shared now. One function for the list and the follow check (§2.2). Pure.
 */
export type ShareEvent = { id: number; search_id: string; kind: "share" | "unshare" };
export function sharedNow(events: ShareEvent[]): Set<string> {
  const latest = new Map<string, ShareEvent>();
  for (const e of events) {
    const k = String(e.search_id);
    const had = latest.get(k);
    if (!had || e.id > had.id) latest.set(k, e);
  }
  return new Set([...latest].filter(([, e]) => e.kind === "share").map(([k]) => k));
}
