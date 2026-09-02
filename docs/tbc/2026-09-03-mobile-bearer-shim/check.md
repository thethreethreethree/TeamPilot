# CHECK — accept a mobile Bearer token on the coach routes

## The canonical gate, whole

`package.json` defines `check` as seven commands. All seven were run, in one invocation,
after the final edit. Output pasted below; run again before merge.

```
$ npm run check
> npm run typecheck && npm run lint && npm run theme:audit && npm run rls:audit
  && npm run invariant:audit && npm run tbc && npm run test

  tsc --noEmit                                     (no output)
  eslint "**/*.ts" "**/*.tsx"                      (no output)
  theme-audit      Files scanned: 1562 · 169 brand hex, 0 named · 10 allowlisted
  rls-audit        238 migrations · 138 RLS tables · 0 without RLS · 0 tenant-pin
                   risks · 0 missing policies · 0 RLS-bypassing views
  invariant-audit  970 files · 38 documented exceptions · 0 violations
  tbc              docs / manifest / artifacts / residual / freshness
  vitest run       Test Files 595 passed | 1 skipped (596)
                   Tests    3940 passed | 15 skipped (3955)

exit code: 0
```

## The evidence that matters most

Every existing test passes **unmodified**, except two files whose `GET()` signature gained
a request parameter. No assertion was changed anywhere. That is the strongest available
evidence that web behaviour is untouched: the suite describes the cookie path in detail,
and it still describes it correctly. The suite is two tests larger than before this branch
(3,938 → 3,940) — the self-tests added to the invariant audit.

## Contract checks, read term-for-term this session

- `getCurrentAuthContext` returns `{ userId, companyId, role, isAdmin }`
  (`src/lib/supabase/auth-helpers.ts:47`). `resolveApiAuth` returns the identical shape,
  so every downstream branch — `isAdmin` gating, company scope, RLS-scoped queries — is
  untouched.
- `createSession` writes through `createServiceRoleClient()`
  (`src/lib/data/salesCoach.ts:165`), which is why `POST /sales-session` needs identity
  only.
- `getSession` and `getSessionTranscript` both used `createServerClient()` — the cookie
  client. Both now take an optional client and default to it.

## Re-run after the door-log route was added

```
$ npm run check
exit code: 0
  vitest run   Tests 3940 passed | 15 skipped (3955)
  invariant    970 files · 0 violations
  door-log     4 files, 20 tests, all passing — unmodified
```

The door-log route's own 20 tests pass **unchanged**, which is the same evidence
the first eight routes gave: the cookie path is described in detail by those
tests and they still describe it correctly.

## Findings

### F1 — /outcome was made to require a company context it never required

Adding mobile support to `/[id]/outcome` initially used the full `resolveApiAuth`, which
returns null without a profile carrying a `company_id`. That route only ever asked "is
anyone signed in?", so the change would have started rejecting a signed-in **web** user
who has no company — a regression to the existing path, introduced while adding a new one.
Its own existing tests went from 200 to 401 and caught it. `resolveApiUserId` (identity
only, no company, no role) preserves the original requirement exactly, and those tests now
pass unmodified.

class: widening auth to a new caller by substituting a *stricter* resolver, so the new
  caller gains access and an existing caller silently loses it.
sweep: `grep -rn "resolveApiAuth(" src/app/api/ | ...` then, for each hit, confirm the
  route previously called `getCurrentAuthContext()` (same requirement) rather than a
  looser check. Done for all eight routes in this branch; `/outcome` was the only one.
severity: high — it is a live regression to the web product, not to the unshipped one,
  and the only reason it did not ship is that this route happened to have tests.

### F2 — the canonical gate was substituted with a faster subset

While building, `tsc --noEmit`, `vitest run` and `node scripts/invariant-audit.mjs` were
run repeatedly and reported as the verification for this branch — three of the seven
commands `npm run check` runs. The first full run of the canonical gate **failed**, on an
unused `getCurrentCompanyId` import left behind in `sales-session/route.ts` when that route
moved to `resolveApiAuth`. The subset had been clean the whole time, because the subset
does not include project-wide `eslint`.

class: reporting a subset of the project's canonical gate in the register of the whole
  gate (A38). The report reads identically either way, which is what makes it durable.
sweep: `npm run check` — that is the whole boundary. There is no narrower command whose
  green means anything for this branch.
severity: medium — it produced one real defect here, caught before merge, but the shape
  is what lets a red `main` sit unnoticed for a day (A38's own recorded case).

## Not claimed

- **No live request has been made against a deployment.** Nothing here shows that a real
  Supabase JWT is honoured by a real PostgREST, or that RLS behaves as reasoned under a
  token rather than a cookie. Everything above is static analysis and unit tests.
- The curl checks that exercise BOTH auth paths — including that a Bearer for rep A never
  returns rep B's rows — are written out in the app repo's `PHASE-3-SHIM-TO-APPLY.md` and
  **have not been run**. They should be, before this is deployed.
- The `invariant-audit.mjs` change widens what the audit accepts as an auth gate. Its own
  self-tests confirm it still rejects an ungated mutation, but a human should read it.
