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

## Later the same hour (appended 2026-10-01T19:58Z)

### The timeouts were DeepSeek, not this code

class: a paid provider that hangs instead of refusing; each call waits out its 45 s timeout and its retry
sweep: src/lib/llm/index.ts - the provider fallback cascades on auth and model_unavailable only, not on timeout
severity: high

From this machine, read-only, with the key in .env.local: DeepSeek's balance endpoint answered in 292 ms
(is_available true, USD 6.60); two three-word chat requests got no answer in 60 s and in 90 s (19:53:53Z).
status.deepseek.com at about 19:54Z: "DeepSeek Web/API Degraded Performance ... The issue is being investigated
... Affects Chat service, DeepSeek V4.1 Flash API". So the 504s from 19:27:40Z are the outage, and deleting the
duplicate project at about the same time did not cause them. Every AI feature in production is down until
DeepSeek recovers. Also: rollupDueReps only considers pitches from the last 24 h, so rep 2d03f5e5 would have
left the loop at about 20:10Z on its own; a healthy cron after this deploy does not by itself show the fix
works. The proof of the fix is the test.

### The post-deploy smoke stopped running when the duplicate project was deleted

class: a CI condition keyed to a name a third party chooses
sweep: grep -n "environment" .github/workflows/*.yml
severity: high

Vercel names the GitHub environment "Production - <project>" only while several projects deploy the repo; with
one it is plain "Production". The workflow matched endsWith 'team-pilot', so it skipped every deploy after the
deletion (5 skipped runs on cf7c722f, read from the Actions API). Now it matches both names exactly; the
deployments API's environment names were compared to the workflow byte for byte: "Production" and
"Production [en dash] team-pilot" match, "...-6wlo" and "github-pages" do not.
