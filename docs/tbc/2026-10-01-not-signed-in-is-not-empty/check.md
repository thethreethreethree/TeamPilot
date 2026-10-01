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

## Appended 2026-10-01 — R1: the smoke, widened to every GET route

```
$ python docs/mobile-smoke/all-get-routes.smoke.py      (production, GET only, no login)
GET routes: 196  by status: {'200': 4, '400': 10, '401': 179, '403': 3}
```

- 200: /api/health (public by design), /api/me/identity (answers `userId: null`, its job), /api/me/landing (a
  landing path, nothing private), and **/api/me/coach-memory**, a zero-filled snapshot to a stranger. Fixed: 401.
- 400 "Not authenticated": **/api/tasks** and **/api/team** (and /api/problems, same helper, no GET). One
  helper returned three failures (no database, not signed in, onboarding unfinished) and every call site sent
  400. Each failure now carries its status: 401, 503, 400; all 10 call sites use it.
- The other 400s are parameter checks before the login; unchanged.

```
$ npx vitest run src/app/api/__tests__/notSignedIn.test.ts
      Tests  11 passed (11)
exit 0
$ (mutation: tasks' not-signed-in back to 400)        Tests  4 failed | 7 passed (11)   exit 1 (restored)
$ npx vitest run src/app/api/tasks src/app/api/team src/app/api/problems
      Tests  83 passed (83)
exit 0
```

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
      Tests  5618 passed | 15 skipped (5633)
  RLS probes:              1 run, 0 failed
CHECK_EXIT=0
```

## Appended 2026-10-01 — the smoke runs itself after every deploy

The GET smoke moved to `scripts/smoke/production-get-smoke.py` and now exits 1 when a route outside its PUBLIC
list (health, identity, landing, each with its reason) answers 200, or any route answers 5xx or 404.
`.github/workflows/post-deploy-smoke.yml` runs it on every successful `Production – team-pilot` deployment
(Vercel reports deployments to GitHub: seen for 5fd80868). GET only; an alarm on the deployed commit, not a gate
in front of production.

```
$ python scripts/smoke/production-get-smoke.py
OK: no route outside PUBLIC answers a stranger with data; no 404, no 5xx.
exit 0
$ (mutation: /api/me/landing removed from PUBLIC)
FAIL:
  200  /api/me/landing
exit 1   (restored)
```

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
      Tests  5618 passed | 15 skipped (5633)
CHECK_EXIT=0
```
