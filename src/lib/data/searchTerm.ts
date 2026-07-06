/**
 * Sanitize a user-supplied search string for safe interpolation into a PostgREST
 * RAW filter — the `.or("col.ilike.<term>,other.ilike.<term>")` API, which does
 * NOT escape its argument.
 *
 * Why this exists (§A13 — author the space once)
 * ─────────────────────────────────────────────
 * `.or(...)` takes a raw PostgREST filter string. An unescaped COMMA in <term>
 * ends the current condition and starts a new one; PARENTHESES open a grouping /
 * in-list. So a search for `x,id.gt.0` interpolated into
 * `title.ilike.%x,id.gt.0%,description.ilike.%x,id.gt.0%` breaks OUT of the ilike
 * into an attacker-chosen `.or()` condition — PostgREST filter injection. RLS is
 * the backstop for cross-tenant reads, but injection can still widen results
 * within a tenant (e.g. inject `id.gt.0` to match every row) or produce
 * malformed-filter 400s. Four call sites had the same shape (files/crm/care/global
 * search), so this is the shared fix, not a per-site patch.
 *
 * What it does: strips the three STRUCTURAL metacharacters (`,` `(` `)`). The
 * ilike wildcards `%` and `_` are preserved (the callers add their own `%…%`),
 * and every other character is inert inside an ilike value. A search term almost
 * never contains a literal comma/paren, so the fidelity cost is negligible and
 * the injection surface is removed entirely (foolproof-strip over clever-escape:
 * for a security fix, no-way-to-inject beats preserve-every-char).
 *
 * NOT needed for the parameterized APIs: `.ilike(col, value)`, `.eq()`, `.in()`
 * etc. already escape their arguments. Only the raw `.or()`/`.filter()` strings
 * are unsafe. And `id.eq.<uuid>` interpolation of DB-sourced UUIDs is safe by
 * type (UUIDs contain no structural metacharacters) — this helper is for
 * user-derived ilike terms specifically.
 */
export function sanitizeOrIlikeTerm(raw: string): string {
  return raw.replace(/[,()]/g, " ").trim();
}
