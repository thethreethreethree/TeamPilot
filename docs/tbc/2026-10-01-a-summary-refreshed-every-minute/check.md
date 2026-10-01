# CHECK - a summary refreshed every minute

## Commands

```
$ (production, read-only) pg_stat_user_tables
  rep_pattern_summaries   ins 80   upd 14142   live 80
$ (production, read-only) rep 2d03f5e5: latest complete pitch 09-30 20:09:54; newest summary 09-30 20:09:10
$ npx vitest run src/lib/data/__tests__/doorlog.rollupFreshness.test.ts src/lib/coach/doorlog
      Tests  140 passed (140)
exit 0
$ (mutation: generated_at line removed)      Tests  2 failed (2)    exit 1 (restored)
```

The full `npm run check` is appended below.

## Findings

### A cost gate read a timestamp the write never updated

class: an upsert whose freshness column is only set by a column DEFAULT (insert-only), read by a "skip if fresh" gate
sweep: grep -rn "\.upsert(" src/lib src/app/api - for each table, does any gate read a default-only timestamp column?
severity: high

14,142 summary rewrites, each after an AI call, for 80 rows. Likely the source of the unexplained DeepSeek spike
(09-20..22, 8,571 calls) and the steady background calls in the cost estimate; not provable from the counters.

### A duplicate Vercel project ran every scheduled job a second time

class: a second deployment target with production secrets
sweep: vercel project ls; every project deploying this repo
severity: high

Deleted (founder's pick). The loop above ran in both projects.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 ... npm run check
  Test Files  727 passed | 1 skipped (728)
       Tests  5620 passed | 15 skipped (5635)
exit 0
```
