# CHECK - aggregate reads of sales reviews leave meetings out

## Commands

```
$ npx tsc --noEmit -p .                                                          exit 0
$ npx vitest run src/lib/coach/v5/__tests__/nonSalesSubjects.test.ts src/app/api/coach/sales-session/my-training src/app/api/coach/sales-session/coach-assessment
      Test Files 3 passed · Tests 15 passed
$ node scripts/invariant-audit.mjs                                               Violations: 0
$ (mutation: my-training's nonSalesSubjects call removed)  invariant-audit       1 violation (restored)
```

The full `npm run check` is appended below.

## Findings

### Two aggregate pages counted reviews written on meetings

class: a cross-call aggregate that a per-call guard cannot reach
sweep: every handler INVARIANT 34 exempted (list, coach-assessment, my-training, finalize), each read by hand
severity: low

Bounded at 2 events; now left out.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (2026-10-13)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe54 psql -U postgres" PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres npm run check
  Violations: 0
  Tests  5742 passed | 15 skipped (5757)
  exit 0   (no SKIPPED line)
```

Two earlier runs failed on the record itself: tbc:artifacts ("green" with no command beside it in build.md) and
tbc:residual (an empty residual list). Both were fixed in the record, not by loosening the gates.
