/**
 * Missing-column detection — the load-bearing predicate behind the guarded fallbacks around migration 0187's
 * recording_saved columns.
 *
 * WHY this exists (the 2026-07-03 migration-coupling outage): code that assumes a migration is applied takes
 * the feature down when it isn't. The defense is a guarded fallback. But a fallback is only safe if it fires
 * ONLY for "this column isn't there yet" and never masks a genuine failure — a real error must stay loud
 * (§3.4: distinguish live-error from live-empty). That decision is this predicate, so it lives here as a pure,
 * unit-pinned function rather than inline and trusted in two route handlers.
 *
 * Two things the naive inline version got wrong, pinned by the tests:
 *  - A bare code check is too permissive: 42703 for a DIFFERENT column is a real bug, not a pending migration.
 *    The error must name the column we're guarding, or we stay loud.
 *  - Reads and writes fail differently: PostgREST returns 42703 ("column ... does not exist") on select, but
 *    PGRST204 ("Could not find the 'x' column ... in the schema cache") on update.
 */

export type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

/** Codes both PostgREST and Postgres use for "that column isn't in the schema". */
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

/**
 * True only when `error` says the named `column` is absent from the schema — i.e. its migration is pending.
 * Any other error (including a different column missing) returns false so the caller fails loudly.
 */
export function isMissingColumnError(error: PostgrestLikeError, column: string): boolean {
  if (!error) return false;

  const message = typeof error.message === "string" ? error.message : "";
  // Must name the column we're guarding. A missing OTHER column is a real defect and must not be swallowed.
  if (!column || !message.includes(column)) return false;

  const code = typeof error.code === "string" ? error.code : "";
  if (MISSING_COLUMN_CODES.has(code)) return true;

  // Some paths omit the code; the canonical phrasings still identify the case unambiguously.
  return /does not exist|schema cache/i.test(message);
}
