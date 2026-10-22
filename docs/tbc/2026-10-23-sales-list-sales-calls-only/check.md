# CHECK - the sales list shows sales calls only

## Commands

```
$ npx tsc --noEmit -p .                                              exit 0
$ npx vitest run src/app/api/coach/sales-session/list                Tests 19 passed (19)
$ (mutation: the .not filter removed)                                Tests 2 failed | 17 passed (19)   (restored)
```

The full `npm run check` is appended below.

## Findings

### Meetings and huddles appeared in the sales list

class: a list wider than the feature it opens into
sweep: the list route's one consumer and the iOS app's session list
severity: low

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (2026-10-23)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe54 psql -U postgres" PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres npm run check
  Violations: 0
  Test Files  739 passed | 1 skipped (740)
  Tests  5750 passed | 15 skipped (5765)
  exit 0   (no SKIPPED line)
```
