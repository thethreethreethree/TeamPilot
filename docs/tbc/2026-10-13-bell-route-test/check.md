# CHECK - the bell route gets a test of its own

## Commands

```
$ npx vitest run src/app/api/coach/gamification/notifications      Tests 6 passed (6)
$ (mutation: the unread count's .is("read_at", null) removed)       Tests 1 failed | 5 passed (6)   (restored)
```

The full `npm run check` is appended below.

## Findings

### The bell's unread filter had no test

class: a query-builder filter whose removal fails nothing
sweep: the one route named by the residual; no other route was swept in this build
severity: low

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (2026-10-23)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe54 psql -U postgres" PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres npm run check
  Violations: 0
  Test Files  739 passed | 1 skipped (740)
  Tests  5748 passed | 15 skipped (5763)
  exit 0   (no SKIPPED line)
```

Three earlier runs (2026-10-13/14) failed on timeouts in unrelated tests (a different set each run) and once on two
migrations that "could not apply" with no SQL error, while the machine had under 1 GB of free memory. With the other
projects' Docker containers stopped (founder's choice, 2026-10-20) the same tree passed. No test was loosened.
