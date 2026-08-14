# REMEDIATE — /retranscribe diarization cache

## F1 — cache the diarization so a repeat skips STT
Remediation: a dedicated `coaching_retranscribe_cache` table (migration 0213, service-role-only RLS) stores the
diarization keyed on the session + its `audio_asset_url`. The route returns the cached result WITHOUT STT when it
matches the current recording (self-invalidating on a re-upload; `?force=1` forces a refresh); a failed STT is
never cached. So a reload / 2nd tab / on-mount auto-fire / manual re-click no longer each re-charge a full
batch STT for the same recording.
gate-or-promise: gate. The route test locks: a cache hit returns the stored result with NO STT/download; a stale
pointer or `?force=1` re-diarizes; a miss caches keyed on the current recording. The rls-audit allowlist locks
the service-role-only access (the audit fails without it). Removing the cache read reddens CI.
class: cost / server-idempotency. severity: high. Fixed.

## Note
Migration applied via `npm run db:apply` (never hand-applied — off-ledger drift breaks the next apply). db:apply
result in closure.md.
