# Check — canonical command + security proofs

## Findings
No findings. The load-bearing risk was the SECURITY BOUNDARY (admin-creates-user + a shared credential), so the
verification proves gating + policy + tenant-pinning on every route, and the audits confirm no RLS/gating gap.
Open items are the ranked residual in closure.md (R1 multi-company deferral, R2 secret-at-rest, R3 live-DB apply)
— deliberate scope calls, not defects.

## Canonical verification command (A38)
```
npm run check
```
= typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test. Result this build:
```
✓ theme:audit · ✓ rls:audit · ✓ invariant:audit · ✓ tbc:* · Tests 3446 passed | 15 skipped
exit 0
```
invariant:audit explicitly passes "every admin route gated" and "every non-public mutation route references a
recognised auth/tenant gate" — the new routes are covered.

## Proofs (route + unit tests, not mocks of the boundary)
- **Gating** — `passwords`/`add-member`/`set-password` route tests: 401 unauth, 403 non-admin on every route.
- **Policy** — `passwordPolicy.test.ts`: 8+/upper/lower/digit/special, first-failing-rule; a weak team password
  → 400 and a weak first-login password → 400 (same validator).
- **Add paths** — existing unknown-email → 404; existing known → upsert pinned to the CALLER's company (asserted
  `company_id: c1`); new duplicate → 409; new → `createUser({password: teamSecret})` + `must_change_password:true`
  (both asserted).
- **set-password** — sets the caller's OWN id (from session, asserted `updateUserById("u1", …)`) + clears the flag.
- **RLS** — team_passwords deny-all; rls:audit green with the allowlist reasons.

## Not verified here (honest — needs live DB / browser)
- The real `auth.admin.createUser` + the forced-change redirect on a live session — needs migration 0235 applied
  (`npm run db:apply`) and a browser. The deterministic layers pass npm run check (exit 0). This is the R3 residual.
