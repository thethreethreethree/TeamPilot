import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { currentCategories, type Pick } from "./callCategories";

/**
 * Each call's CURRENT category (0367), through the caller's client (the call's own read rule), chunked and paged.
 * Calls never picked are absent; a cleared pick is null. null = a failed read (never "no category").
 */
export async function categoriesOf(db: SupabaseClient, sessionIds: string[]): Promise<Map<string, string | null> | null> {
  const ids = [...new Set(sessionIds)];
  const picks: Pick[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await fetchAllPagedResult<Pick>(
      (from, to) => db.from("call_category_picks").select("id, session_id, category_id").in("session_id", ids.slice(i, i + 150)).order("id", { ascending: true }).range(from, to),
      { label: "call category picks", maxRows: 200_000 },
    );
    if (error) return null;
    picks.push(...(data ?? []));
  }
  return currentCategories(picks);
}
