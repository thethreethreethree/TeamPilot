# CHECK - the KPI job finishes

## Commands

```
$ npx vercel@latest logs --project team-pilot --json --since 7d --query compute-cron   (non-401 rows)
  09-27 .. 10-03  05:00:40  504  Vercel Runtime Timeout Error: Task timed out after 60 seconds   (7 of 7)
$ (production, read-only) coaching_sessions 376 rows / 12 agents; kpi_snapshot 'current' 70 rows, latest 05:01:39
$ npx tsc --noEmit -p .
exit 0
$ npx vitest run src/app/api/coach/kpi
 Test Files  5 passed (5)
      Tests  31 passed (31)
exit 0
$ (mutation: the previous per-row loop with the new tests)   Tests  4 failed | 5 passed   exit 1 (restored)
```

The full `npm run check` is appended below.

## Findings

### The daily KPI job never finished, and dropped the last agents' snapshots each day

class: a sequential per-row write loop whose round trips outgrow the function's time budget
sweep: grep -rn "for (const .* of .*) {" src/app/api/**/*cron*/route.ts with an await inside; each other cron's real runs are 200 (Vercel logs, 26 h)
severity: medium

Every other scheduled job answered 200 on its real run. The KPI trajectory a manager sees has been missing its
last agents' current values since at least 2026-09-27.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (two runs)

```
$ MIGRATION_AUDIT_PSQL=... PGPORT=55433 ... npm run check
run 1: exit 1   invariant:audit: service-role statement names no tenant, compute-cron route.ts:184 (the batched insert:
       its rows carry company_id, but built in a variable the audit cannot see). Added
       "coach/kpi/compute-cron::kpi_snapshot::write" to the system-crons allowlist beside the delete it already
       held, with a comment at the rows naming the guard.
run 2: exit 0
 Test Files  730 passed | 1 skipped (731)
      Tests  5678 passed | 15 skipped (5693)
```
