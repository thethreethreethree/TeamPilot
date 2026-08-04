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
 *  - Reads and writes appear to fail differently: 42703 ("column ... does not exist") on select, and PGRST204
 *    ("Could not find the 'x' column ... in the schema cache") on update.
 *
 * ⚠️ THE CODES ARE RECOLLECTED, NOT VERIFIED (flagged 2026-07-17). `PGRST204` in particular is asserted from
 * memory: it appears nowhere else in this repo, no other PostgREST code is handled anywhere in src/, and it has
 * not been observed against a live PostgREST here. It is written down because it is probably right — not because
 * it is known right, and an earlier asset this session (A37, retracted) proved what my recollection is worth.
 *
 * The predicate is deliberately built NOT to depend on the codes being right: it requires the message to NAME
 * the guarded column, and then accepts a known code OR the canonical phrasing (`does not exist` / `schema
 * cache`). So a wrong/missing code still degrades correctly through the message path — and a message that names
 * the column but describes something else (a constraint violation) still fails loudly. If the first real
 * pre-0187 write shows a different code, add it to MISSING_COLUMN_CODES and correct A34's line; nothing else
 * needs to change.
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

/** Codes Postgres (42P01) / PostgREST (PGRST205) use for "that table/relation isn't in the schema". */
const MISSING_RELATION_CODES = new Set(["42P01", "PGRST205"]);

/**
 * Table/relation sibling of isMissingColumnError — true only when `error` says a table isn't in the schema
 * (its migration is pending), so a guarded fallback can return empty for THAT case while a genuine failure
 * stays loud. Same defense-in-depth as the column predicate: a known code OR the canonical phrasing
 * (`relation … does not exist` / `Could not find the table … in the schema cache`). Pass `relation` to also
 * require the message to name it (stricter). Any other error → false → the caller fails loudly.
 */
export function isMissingRelationError(error: PostgrestLikeError, relation?: string): boolean {
  if (!error) return false;

  const message = typeof error.message === "string" ? error.message : "";
  if (relation && !message.includes(relation)) return false;

  const code = typeof error.code === "string" ? error.code : "";
  if (MISSING_RELATION_CODES.has(code)) return true;

  return /relation .* does not exist|could not find the table/i.test(message);
}
