# CHECK - give the KPI routes the caller's own client

## Findings

### F1 - four routes authenticate a mobile caller and then read as nobody
class: bearer-route-reads-through-a-cookie-client (the same class as the four bugs of 2026-09-04/05)
sweep: enumerate the 23 endpoints the app calls, then `npm run invariant:audit` with INVARIANT 26 widened to inspect the route body
severity: high
`resolveApiAuth` widens IDENTITY and returns no database client. `coach/kpi/me`, `coach/kpi/team`,
`coach/kpi/trajectory` and `coach/sales-session/quota` then resolved their own cookie client and ran every
query through it. For a Bearer caller that client is anonymous, RLS returns nothing, and the route answers
200 with zeros.

MEASURED against production on 10 September 2026 with a real token for the founder's own account, which holds
73 coaching_sessions and 24 kpi_snapshot rows and is `role: admin` / `sales_coach_role: admin`:

    /api/coach/sales-session/macro-mode   200  {"enabled":false}                       <- control: token is good
    /api/coach/kpi/me?scope=self          200  {"sessionCount":0, metrics all null}
    /api/coach/kpi/trajectory             200  {"building":true,"monthsCovered":0}
    /api/coach/kpi/team                   403  {"error":"Manager access required."}
    /api/coach/sales-session/quota        401  {"error":"Not authenticated."}

Three screens in the native app - KPI, Trend, Team - showed every rep a confident nothing. Fixed; see
remediate.md.

### F2 - the guard written for this exact class could not see it
class: audit-boundary-drawn-from-the-sample (A21)
sweep: read INVARIANT 26's own selection conditions in scripts/invariant-audit.mjs
severity: high
INVARIANT 26 was added on 5 September after four bugs of this shape. It walks the import graph and flags
LIBRARY modules: `n !== start && n.startsWith("src/lib/")`. The route's own body was excluded twice over. The
four bugs it was built from all lived in libraries, so "library" was written into the rule as though it were
the class; it was a property of the sample. The audit reported 0 violations while four routes were broken.
Fixed; see remediate.md.

### F3 - a recording can be written off as lost when its size merely could not be read
class: unknown-treated-as-a-zero
sweep: `grep -rn "?? 0" src/` in the native app, then open each hit rather than count it
severity: medium
In the app's `lib/audio/in-flight.ts`, launch recovery treats `exists && size === 0` as "nothing was
captured", clears the recovery marker and reports the call lost - and because the marker is cleared, no later
launch retries. `File.size` is documented as returning 0 both for an empty file AND for one that cannot be
read, so an unreadable stat is indistinguishable from an empty recording. NOT fixed in this build: it is in
the app repository, not this one, and the honest repair changes what a rep is told about a lost call, which
is the founder's decision. Recorded here so the sweep's boundary is on the record (A26).

## Mutation proof (A30)
```
$ # INVARIANT 26 must FAIL when a route goes back to the bare cookie client
$ npm run invariant:audit
  Violations:           0
$ # revert kpi/me to `const sb = await createClient()`
$ npm run invariant:audit
  Violations:           1
    src/app/api/coach/kpi/me/route.ts
$ # restore
$ npm run invariant:audit
  Violations:           0
```
The mutation was asserted to have applied before each run; a mutation that silently does not apply proves
nothing.

## The rule was made PRECISE as well as wider (A30's false-positive constraint)
A presence-test for `await createClient()` flagged 27 routes - every Bearer route in the repo, including
every correctly fixed one - because the CORRECT pattern contains that call as its fallback, in two spellings.
Counting bare occurrences instead took it to 6, and reading those 6 took it to 2 genuine finds, both closed.
An audit that cries wolf on correct code is one people learn to skip, and then the real leak rides in behind
the noise.

## Canonical command
```
$ TBC_BUILD=2026-09-10-kpi-routes-cookie-client npm run check
  typecheck | lint | theme:audit | rls:audit | invariant:audit | tbc | test
  theme:audit      - No theme-bound leaks. (1643 files scanned)
  rls:audit        - Tables without RLS: 0
  invariant:audit  - Files scanned: 1012 | Violations: 0
  tbc:docs OK  tbc:manifest OK  tbc:artifacts OK  tbc:residual OK  tbc:freshness OK
  Test Files  634 passed | 1 skipped (635)
       Tests  4188 passed | 15 skipped (4203)
EXIT_CHECK=0
```

## Still to verify
The production re-probe AFTER this deploys. The fix is proven locally and by the gate; the flip from
`sessionCount: 0` to a real number cannot be observed until elostate.com is running this commit.
