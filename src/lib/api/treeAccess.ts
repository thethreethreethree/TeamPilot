import type { SupabaseClient } from "@supabase/supabase-js";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";

/**
 * The reporting-tree verdict for routes that act with the service role (RSS Phase 0 step 8 sweep).
 *
 * WHY. Migration 0273 narrows manager access to the rep's chain IN RLS, once a company is on the tree. A route
 * that reads or writes with createAdminClient bypasses RLS, so it must ask the same question explicitly — or a
 * manager outside a rep's chain could still override, comment on or request a rep's recording by id.
 *
 * ONE RULE. Both helpers call the database functions the policies use (rss_tree_allows / rss_tree_filter)
 * through the CALLER's client, so auth.uid() is the person asking and nothing is re-derived here (§2.2).
 *
 * FAILURE MODES, deliberately different:
 *   · the function does not exist (0273 not applied) → allowed: that is exactly today's behaviour;
 *   · any other error → refused / empty: an access check that cannot be answered fails closed.
 */
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

/** The caller's own client: Bearer token (phone, extension) first, else the cookie session. */
async function callerDb(req: Request): Promise<SupabaseClient> {
  return callerScopedDb(req) ?? (await createClient());
}

export async function treeAllowsRep(req: Request, repId: string): Promise<boolean> {
  try {
    const db = await callerDb(req);
    const { data, error } = await db.rpc("rss_tree_allows", { rep: repId });
    if (error) {
      if (MISSING_FUNCTION.has(String(error.code))) return true;
      console.error(`[treeAccess] rss_tree_allows failed: ${error.message}`);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error("[treeAccess] rss_tree_allows threw:", err);
    return false;
  }
}

/** The subset of `repIds` the caller may see. Order is preserved. */
export async function treeFilterReps(req: Request, repIds: readonly string[]): Promise<string[]> {
  if (repIds.length === 0) return [];
  try {
    const db = await callerDb(req);
    const { data, error } = await db.rpc("rss_tree_filter", { reps: [...repIds] });
    if (error) {
      if (MISSING_FUNCTION.has(String(error.code))) return [...repIds];
      console.error(`[treeAccess] rss_tree_filter failed: ${error.message}`);
      return [];
    }
    const allowed = new Set(((data ?? []) as string[]).map(String));
    return repIds.filter((id) => allowed.has(id));
  } catch (err) {
    console.error("[treeAccess] rss_tree_filter threw:", err);
    return [];
  }
}

/**
 * Like treeFilterReps, but null when the tree couldn't be asked (review 2026-11-26): a route that shows a TEAM must say
 * "couldn't load" rather than show an empty team, which reads as "no data" (§3.4). A missing function (0273 not applied)
 * is still "everyone", as treeFilterReps.
 */
export async function treeFilterRepsChecked(req: Request, repIds: readonly string[]): Promise<string[] | null> {
  if (repIds.length === 0) return [];
  try {
    const db = await callerDb(req);
    const { data, error } = await db.rpc("rss_tree_filter", { reps: [...repIds] });
    if (error) {
      if (MISSING_FUNCTION.has(String(error.code))) return [...repIds];
      console.error(`[treeAccess] rss_tree_filter failed: ${error.message}`);
      return null;
    }
    const allowed = new Set(((data ?? []) as string[]).map(String));
    return repIds.filter((id) => allowed.has(id));
  } catch (err) {
    console.error("[treeAccess] rss_tree_filter threw:", err);
    return null;
  }
}

/**
 * Like treeAllowsRep, but null when the tree couldn't be asked (review 2026-11-26): a route can answer "couldn't check"
 * (503) instead of "not in your team" (404) for a manager who is in fact allowed. A missing function is still "allowed".
 */
export async function treeAllowsRepChecked(req: Request, repId: string): Promise<boolean | null> {
  try {
    const db = await callerDb(req);
    const { data, error } = await db.rpc("rss_tree_allows", { rep: repId });
    if (error) {
      if (MISSING_FUNCTION.has(String(error.code))) return true;
      console.error(`[treeAccess] rss_tree_allows failed: ${error.message}`);
      return null;
    }
    return data === true;
  } catch (err) {
    console.error("[treeAccess] rss_tree_allows threw:", err);
    return null;
  }
}
