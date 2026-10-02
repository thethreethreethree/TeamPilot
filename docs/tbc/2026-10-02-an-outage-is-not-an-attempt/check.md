# CHECK - an outage is not an attempt

## Commands

```
$ (production, read-only) coach.dissect_attempted by shape: threw 6 (09-14 .. 09-25), no_signal 92, no_agent_turns 30, unparsable 2, llm_empty 1
$ npx tsc --noEmit -p .
exit 0
$ npx vitest run src/lib/coach/v5 src/components/sales-coach src/lib/llm src/app/api/coach/sales-session/list
 Test Files  150 passed (150)
      Tests  1313 passed (1313)
exit 0
$ (mutation: catch returns "threw" for every error)  npx vitest run runAndStoreDissect.emit.test.ts   Tests  4 failed | 11 passed   exit 1 (restored)
```

The full `npm run check` is appended below.

## Findings

### The sales dissect recorded a provider outage as the call's own failed attempt

class: an account- or provider-level failure charged to the individual item (the pitch worker's class, second instance)
sweep: grep -rn "dissect_attempted\|_attempted\"" src; every marker that backs an item off after a failure
severity: medium

Second instance after the pitch worker (docs/tbc/2026-10-02-an-ai-outage-fails-fast). The meeting dissect writes
its marker only on a no-signal RUN, never on a throw, so it is already right.

### Five sessions are still inside a backoff written during the September outage

class: append-only markers written under the old rule
sweep: the production query above
severity: low

Their markers expire 2026-10-07..09, after which the backfill retries them. They had 2 to 4 earlier attempts, so
they are long-standing no-review sessions, not ones the outage alone took a review from. Not rewritten: events
are append-only.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 ... npm run check
 Test Files  728 passed | 1 skipped (729)
      Tests  5656 passed | 15 skipped (5671)
exit 0
```
