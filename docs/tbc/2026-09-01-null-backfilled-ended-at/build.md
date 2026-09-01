# BUILD — null the misleading backfilled `ended_at`

### The migration (one idempotent, condition-based UPDATE)
- write-path: `supabase/migrations/0240_null_backfilled_session_ended_at.sql` — nulls `ended_at` on every
  `ended` session whose wall-clock span exceeds the 4h code cap AND has no real audio length. Condition-based, not
  keyed to the exact literal timestamp (a tz/precision mismatch made the literal unreliable). Idempotent: a re-run
  matches 0 rows.
- read-path: those sessions now report "duration unknown" everywhere (the same result the code cap already
  produced) — but now the STORED row is honest, not just the rendered number.

### The preview (confirm the target before overwriting)
- write-path: `scripts/diag-backfilled-ended-at.mjs` — READ-ONLY. Classifies the whole `ended`-set with the
  migration's exact WHERE and prints the target count, `ended_at` clusters, span extremes, and the count of
  audio-backed >4h rows it must NOT touch.
- read-path: run before AND after apply — before proves the 218-row target + the 13 protected rows; after proves
  the target is 0 with the 13 still present (pasted in check.md).

## Files
- `supabase/migrations/0240_null_backfilled_session_ended_at.sql` — the cleanup UPDATE (NEW)
- `scripts/diag-backfilled-ended-at.mjs` — read-only target preview / post-apply verifier (NEW)

## Ripple (§6 item 5)
- No code change; no schema change; no trigger change. `status` untouched. `conversationDurationSeconds` already
  handles a null `ended_at`. The 0070 trigger fires on status transitions, not on a direct `ended_at` update.
- Recurrence at the source (the stale-close cron will re-stamp `now()` on future batches) is NOT fixed here; the
  code cap neutralizes it for durations. Named as a residual in closure.md.
