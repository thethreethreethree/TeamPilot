# BUILD — /retranscribe diarization cache

### migration 0213 — coaching_retranscribe_cache
read-path: `supabase/migrations/0213_coaching_retranscribe_cache.sql` creates the cache table (session_id PK,
company_id, audio_asset_url, result jsonb), RLS enabled, service-role-only (no policies).
write-path: applied via `npm run db:apply` (never hand-applied); the 4 ops are allowlisted in
`scripts/rls-audit.mjs` with reasoning.

### retranscribe route — cache read/write
read-path: `src/app/api/coach/sales-session/[id]/retranscribe/route.ts` reads the cache (admin) and returns the
stored result WITHOUT STT when it matches the session's CURRENT audio_asset_url (self-invalidating); `?force=1`
bypasses it.
write-path: after a successful diarization, upserts `{session_id, company_id, audio_asset_url, result}` (onConflict
session_id). A failed download/STT returns 502 BEFORE the write, so a failure is never cached.

### rls-audit allowlist — service-role-only cache ops
read-path: `scripts/rls-audit.mjs` — the audit reads this allowlist to confirm each cache op
(coaching_retranscribe_cache.{select,insert,update,delete}) is a documented service-role-only omission.
write-path: none (static config); the four allowlist entries document the intentional no-policy design so
`rls:audit` passes (the audit fails without them, since the table has RLS + no policies).

## Test coverage
`src/app/api/coach/sales-session/[id]/retranscribe/__tests__/route.test.ts` (admin mock now serves the cache
table): a MISS runs STT + caches keyed on the current pointer; a HIT (matching pointer) returns the cached result
with NO STT/download; a STALE pointer (new recording) re-diarizes; `?force=1` re-diarizes despite a valid cache.
The auth/ownership/404/409/422/502 cases still pass.

## Notes
- No `coaching_sessions` column (avoids bloating its many `.select("*")` reads); a dedicated table instead.
- Self-invalidation via the stored `audio_asset_url` means no invalidation hook is needed at the audio-write
  sites — a missed hook there would serve a stale diarization; the compare can't be missed.
