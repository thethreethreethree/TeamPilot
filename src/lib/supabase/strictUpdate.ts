/**
 * strictUpdate — RLS-honest Supabase mutation helper.
 *
 * Source asset: [[A13]] in ThinkerThinker.md — *Vocabulary-once
 * discipline: when the same class of bug recurs more than twice,
 * the IDENTIFICATION is wrong, not the implementation.*
 *
 * Why this exists
 * ───────────────
 * Supabase's `.update(...).eq(...)` chain returns
 * `{ data: null | T[], error: PostgrestError | null, count }`.
 * When RLS rejects the write — OR a BEFORE/AFTER trigger raises
 * — OR the matched row doesn't exist — the call resolves
 * successfully with `data: null` (or `[]`) and `error: null`.
 * Code that doesn't chain `.select()` AND doesn't check rows-
 * affected ships a silent-failure path: the UI gets HTTP 200,
 * the DB never changed, the user loses confidence in the action.
 *
 * This pattern surfaced in the wild during CAT-001's recovery
 * window: the Close button on a Care conversation called
 * setConversationStatus, the function returned successfully, the
 * conversation status never changed because an AFTER UPDATE
 * trigger's INSERT into support_conversation_events was rejected
 * by RLS, the agent stared at a "still showing open" inbox. Five
 * different write functions in src/lib/data/care.ts had the same
 * shape. Commit 5798ec5 patched each one inline.
 *
 * A13 says: when the same class of bug recurs more than twice,
 * patch-per-instance is the wrong identification. Build a SHARED
 * library at the right altitude. This file IS that library.
 *
 * What it guarantees
 * ──────────────────
 * - `error` set → throws with a descriptive message including
 *   the operation context.
 * - `data` empty (no rows changed) → throws with a descriptive
 *   message stating the likely cause (RLS, trigger, missing row).
 * - `data` populated → returns the rows.
 *
 * What it does NOT do
 * ───────────────────
 * - Does not retry. Idempotency is the caller's contract.
 * - Does not log. The thrown error is the signal; the API layer
 *   converts it to a 4xx/5xx response and the §1.6 divergence
 *   detector in the UI surfaces it to the user.
 * - Does not bypass RLS. If the caller needs service-role,
 *   they use createAdminClient and the same helper still applies
 *   for honest rows-affected checking.
 */

import type { PostgrestError } from "@supabase/supabase-js";

type StrictMutationResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

/**
 * Execute a Supabase mutation that MUST return at least one
 * affected row. Throws on error OR zero-rows.
 *
 * Usage:
 *
 *   const rows = await strictMutate(
 *     sb.from("support_conversations")
 *       .update({ status: "closed" })
 *       .eq("id", id)
 *       .select("id, status"),
 *     { context: "setConversationStatus" }
 *   );
 *   // rows is guaranteed non-empty here.
 *
 * The caller's query MUST chain `.select(...)` or no rows will
 * be returned and this helper will (correctly) throw — but the
 * thrown message will not distinguish "RLS rejected" from "you
 * forgot .select()". Author your callers with .select() always.
 *
 * @throws Error with context prefix when the mutation fails or
 *   matches zero rows.
 */
export async function strictMutate<T>(
  query: PromiseLike<StrictMutationResult<T>>,
  opts: { context: string }
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    throw new Error(
      `${opts.context} failed: ${error.message}` +
        (error.code ? ` (code ${error.code})` : "") +
        (error.hint ? ` — hint: ${error.hint}` : "")
    );
  }
  if (!data || data.length === 0) {
    throw new Error(
      `${opts.context} changed zero rows. Likely cause: RLS policy ` +
        `rejected the write, an AFTER trigger raised, or the matched ` +
        `row no longer exists. Check the Supabase RLS policies for the ` +
        `target table and any audit triggers it fires.`
    );
  }
  return data;
}

/**
 * Convenience: when the caller expects exactly one row affected
 * (the common case for "update by primary key") and wants the
 * row back, not the array.
 *
 * @throws Error when zero or more than one row was affected.
 */
export async function strictMutateOne<T>(
  query: PromiseLike<StrictMutationResult<T>>,
  opts: { context: string }
): Promise<T> {
  const rows = await strictMutate(query, opts);
  if (rows.length > 1) {
    throw new Error(
      `${opts.context} expected to affect exactly 1 row but affected ${rows.length}. ` +
        `The .eq() / .match() / .in() predicate is too broad.`
    );
  }
  return rows[0]!;
}
