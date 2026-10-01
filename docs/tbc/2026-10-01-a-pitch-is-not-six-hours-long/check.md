# CHECK - a pitch is not six hours long

## Commands

```
$ npx vitest run src/app/api/coach/sales-session/pitch-score src/lib/coach/pitchScore
      Tests  426 passed (426)
exit 0

$ (mutation: the old sessionDurationS restored, route test re-run, fix restored)
      Tests  1 failed | 30 passed (31)
exit 1

$ npm run invariant:audit                      (fixed tree)
  Violations:           0
exit 0
$ npm run invariant:audit                      (old scorer restored)
  Violations:           1
    src/lib/coach/pitchScore/scoreSession.ts:290
exit 1
```

The full `npm run check` is appended below.

## Findings

### The pitch scorer re-derived the session-length rule without its cap

class: a second copy of a shared rule that dropped one of its terms (§2.2 drift)
sweep: grep -rnE "Date\.parse\([^)]*ended[^)]*\)\s*-\s*Date\.parse" src - now INVARIANT 31
severity: medium

### An auto-closed session's ended_at is not when the conversation ended

class: a timestamp written by a cleanup job, read as a fact about the user's activity
sweep: grep -rn "ended_at\|endedAt" src --include=*.ts - readers that treat it as conversation end
severity: low

Recorded, not changed: the shared rule already treats such spans as unknown, and every length reader now goes
through it. Changing what the cron stamps would need a migration and a founder go-ahead.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended — the full gate (against postgres:16-alpine, so the migration audit, probes and SQL harness ran)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
  RLS probes:              1 run, 0 failed
✓ 3 claim(s) checked against real Postgres.
      Tests  5593 passed | 15 skipped (5608)
CHECK_EXIT=0
```
