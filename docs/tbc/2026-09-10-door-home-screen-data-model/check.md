# CHECK — door home screen, Phase 04

## Findings
**No findings.** One design note recorded (not a defect): the 30-day ratio filters doors/sold by
`local_date` but presentations by `pitches.recorded_at` (pitches carry no local_date); a 30-day ratio does not
need day-exact precision, and it's documented in the module header so it isn't mistaken for a bug.

## Migration held for review (A34)
```
$ npm run db:dry
  1 pending migration(s):
   • 0247_door_home_screen_day_target.sql
  DRY RUN — nothing applied.
```
0247 is NOT applied. The read layer will fail LOUD (not fabricate) until it lands via `npm run db:apply` after
the founder's review; no UI is wired to it in this increment.

## Targeted suite
```
$ npx vitest run src/lib/coach/doorlog/__tests__/dayTargetData.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)   # frozen / no-goal / compute+freeze / thin-history-starter / window
```

## Canonical command
```
$ npm run check
  typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
  rls:audit — 0 gaps (rep_daily_sales_goal.delete + rep_day_target.update/delete allowlisted with reasons)
  invariant audit: 0 violations
  Test Files  630 passed | 1 skipped (631)
       Tests  4165 passed | 15 skipped (4180)
  Duration    43.92s
EXIT_CHECK=0
```
