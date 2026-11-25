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
 * How many calls match `query` and started after `since` — Remote Sales calls only, through `db` (the caller's own
 * client). The search's own "from" date still applies if it is later. null = couldn't run (never shown as 0).
 */
export async function newMatches(db: SupabaseClient, query: string, since: string): Promise<{ count: number; capped: boolean } | null> {
  const parsed = parseCallSearch(new URLSearchParams(query));
  if ("error" in parsed) return null;
  const from = parsed.filters.from && Date.parse(parsed.filters.from) > Date.parse(since) ? parsed.filters.from : since;
  const r = await runCallSearch(db, { ...parsed.filters, from, remoteOnly: true });
  if (!r.ok) return null;
  return { count: Math.min(r.rows.length, NEW_CAP), capped: r.rows.length > NEW_CAP || r.truncated || r.narrower === true };
}
