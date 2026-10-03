# CHECK - a transcript has versions

## Commands

```
$ (production, read-only) pg_rules on coaching_transcript_segments: _no_delete DO INSTEAD NOTHING, _no_update DO INSTEAD NOTHING
$ (production, read-only) sessions with a recovery attempt: 31 = rep speech now 13 | segments but no rep speech 12 | no segments 6
$ MIGRATION_AUDIT_PSQL=... npm run migration:audit
  RLS probes: 2 run, 0 failed      (0269's probe: all assertions hold)
$ (mutation: the view shows every version)  npm run migration:audit
  RLS probes: 2 run, 1 failed  ERROR: the current view should show version 3 only (3 rows), shows 8 rows of version 3   (restored)
$ (mutation: one website read back on the table)  npm run invariant:audit
  Violations: 1  transcript read from coaching_transcript_segments instead of coaching_transcript_segments_current   (restored)
$ MIGRATION_AUDIT_PSQL=... PGPORT=55433 ... npm run check
 Test Files  731 passed | 1 skipped (732)
      Tests  5685 passed | 15 skipped (5700)
exit 0
$ (app) npx tsc --noEmit                 exit 0
$ (app) npm test                         pass 1589 fail 0
$ (app) npm run lint                     exit 0
$ (app) node ../tools/gate.mjs           exit 0
$ (app, mutation: getTranscript back on the table)  npm test   fail 1   (restored)
```

## Findings

### Every transcript repair failed on a call that already had segments

class: a write path that assumes it may DELETE or UPDATE a table whose rules make those a silent no-op
sweep: pg_rules for every _no_delete / _no_update table x every .delete( / .update( / DELETE / UPDATE against it in src and functions
severity: high

Since 2026-08-14. 12 calls in 2 companies hold segments and no rep speech and could not be fixed by any means.

### A speaker relabel changed nothing and answered "attributed"

class: the same, on UPDATE
sweep: as above
severity: medium

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
