# CLOSURE — /retranscribe diarization cache

## What shipped
`/retranscribe` ran a full batch STT diarization on EVERY POST — guarded only by client refs that reset on
remount — so a reload / 2nd tab / on-mount auto-fire re-charged a full-recording STT every time (the most
cost-dense repeatable charge in the product). It now caches the diarization in a dedicated
`coaching_retranscribe_cache` table (migration 0213, service-role-only RLS) keyed on the session + its
`audio_asset_url`, and returns the cached result WITHOUT STT when it matches the current recording. A re-upload
self-invalidates (pointer mismatch); `?force=1` forces a fresh re-diarize; a failed STT is never cached.

With finalize (finding ⑨), this closes the last "paid generation guarded only by a client latch" instance.

## Verification (A38) — full gate + migration
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-retranscribe-cache-idempotency)
typecheck ✓ · lint ✓ · theme-leak audit — leaks: 0 ✓
RLS policy audit — RLS-enabled tables: 126 · without RLS: 0 ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  415 passed | 1 skipped (416)
     Tests  2876 passed | 15 skipped (2891)
exit 0
```
Migration (never hand-applied):
```
$ npm run db:apply
[db-apply] 1 pending migration(s): 0213_coaching_retranscribe_cache.sql
[db-apply] ✓ applied. ledger records 211 applied migration(s) (through 0213).
[db-apply] ✓ verify:live passed — ALL 26 invariants hold; structural invariants intact after the migration.
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The client SessionRecordingUpload auto-fire still fires on each mount (it just no longer COSTS an STT on a cache hit). A future tidy could also skip the fetch entirely once labeled, but the cost — the point — is gone.", "why_skipped": "The remaining fetch is a cheap cache read; the expensive STT re-charge is eliminated. Not worth more surface now.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T08:12:00Z", "outcome": "Noted." },
  { "id": "R2", "item": "Clock-drift artifact: started_at 08:00Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T08:12:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on `coaching_sessions.audio_asset_url` changing when a new recording is uploaded (upload-recording
  stamps it) — the cache's self-invalidation compares against it.
- Relies on the service role bypassing RLS for the cache read/write (the route's admin client), and on RLS
  denying every direct member access (no policies).

## Status
Complete once the gate shows exit 0 AND migration 0213 is applied (db:apply) + on the ledger. A repeat
retranscribe for the same recording no longer re-charges STT.
