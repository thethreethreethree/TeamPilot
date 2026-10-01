# BUILD - not signed in is not empty

### after-pitch answers 401 to a caller with no login

- **write-path:** `src/app/api/coach/sales-session/[id]/after-pitch/route.ts`, GET and POST: `auth.getUser()` on
  the caller's own client before any read; none → 401 "Not authenticated.".
- **read-path:** route tests "unauthenticated → 401, never an empty 200" and "POST unauthenticated → 401, and
  nothing is generated".

### The smoke is kept

- **write-path:** `docs/mobile-smoke/app-routes.smoke.py` (re-runnable) and its results in `docs/mobile-smoke/README.md`.
- **read-path:** re-run after the fix: the after-pitch GET answers 401 once this commit is deployed; the README states
  the 2026-10-01 results it was written from.
