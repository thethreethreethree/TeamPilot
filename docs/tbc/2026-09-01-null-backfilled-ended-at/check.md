# CHECK — null the misleading backfilled `ended_at`

## Canonical command: `npm run db:apply`
```
[db-apply] 1 pending migration(s):
   • 0240_null_backfilled_session_ended_at.sql
...
✅ ALL 30 invariants hold.

[db-apply] ✓ verify:live passed — structural invariants intact after the migration.
```

## Live before/after (read-only preview — the real proof)
BEFORE apply (`node scripts/diag-backfilled-ended-at.mjs`):
```
total ended sessions scanned: 359
MIGRATION 0240 TARGET (no audio AND span > 4h): 218
ended_at clusters in target set (top 8):
   207  2026-08-21T00:28:33.175267+00:00
     3  2026-08-28T01:15:07.264886+00:00
     2  2026-08-26T01:15:13.143782+00:00
     ...
span range in target: min 0.2d  max 54.7d
sessions with real audio AND span>4h (NOT touched, expect small/0): 13
```
AFTER apply:
```
total ended sessions scanned: 141
MIGRATION 0240 TARGET (no audio AND span > 4h): 0
sessions with real audio AND span>4h (NOT touched, expect small/0): 13
```

## Reading
- Target **218 → 0**: every poisoned `ended_at` cleared. The scanned `ended`-set drops 359→141 exactly because the
  218 nulled rows no longer match `ended_at IS NOT NULL`.
- **13 audio-backed rows untouched** both runs — the `audio_duration_seconds is null` guard held; no real duration
  was destroyed.
- Idempotent: re-running the migration would match 0 rows (all already null).

## Findings
- No findings. The migration matched exactly the previewed target (218 rows), touched no audio-backed session
  (13 protected rows unchanged), and left `status` intact. Nothing surfaced during the before/after check.

## Not claimed
- No unit test (one-shot data migration). Confirmed by the live before/after count above, not by an assertion.
- Recurrence NOT closed here (see closure.md residual); the code cap is the durable duration guard.
