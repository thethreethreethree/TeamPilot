# CHECK - the read side of sales-only

## Commands

```
$ npx tsc --noEmit -p .                                              exit 0
$ npx vitest run src/app/api/coach/sales-session                     Test Files 68 passed · Tests 580 passed
$ node scripts/invariant-audit.mjs                                   Violations: 0
$ (mutation: the summarize GET guard disabled)  invariant-audit      1 violation: [id]/summarize/route.ts (GET) (restored)
```

The full `npm run check` is appended below.

## Findings

### Stored sales reviews on meetings were still served

class: a guard on the write path with no matching guard on the read path
sweep: every exported handler under src/app/api/coach/sales-session (87 route files) by the per-handler rule's dry run
severity: medium

### Aggregate reads still count 2 pre-guard reviews on non-sales sessions

class: same
sweep: as above (list, coach-assessment, my-training)
severity: low

Bounded: no new ones can be written. Recorded as R1-aggregate-reads.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (2026-10-13)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe54 psql -U postgres" PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres npm run check
  Violations: 0
  Tests  5733 passed | 15 skipped (5748)
  exit 0   (no SKIPPED line)
```
