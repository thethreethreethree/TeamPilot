# CHECK - not signed in is not empty

## Commands

```
$ python docs/mobile-smoke/app-routes.smoke.py     (production, unauthenticated, no body)
53 calls, 20 not 401/403/405   — 19 x 400 (body before login), 1 x 200 GET after-pitch
$ npx vitest run "src/app/api/coach/sales-session/[id]/after-pitch"
      Tests  9 passed (9)
exit 0
$ (mutation: GET's 401 check removed)       Tests  1 failed | 8 passed (9)
exit 1   (restored)
```

The full `npm run check` is appended below.

## Findings

### A route answered "nothing here" to a caller who was not signed in

class: an auth failure reported as an empty result (RLS-empty read returned as 200)
sweep: the smoke itself, over every route the app calls; widen it to every route under src/app/api
severity: medium

### Body validation runs before the login check on 19 routes

class: a 400 where a 401 is the truer answer for an anonymous caller
sweep: the smoke's 400 rows
severity: low

Not changed: the app always sends a valid body, so an expired login still reaches the 401.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended — the full gate (against postgres:16-alpine)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
      Tests  5607 passed | 15 skipped (5622)
  RLS probes:              1 run, 0 failed
CHECK_EXIT=0
```
