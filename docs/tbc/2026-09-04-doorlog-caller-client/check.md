# CHECK - doorlog honours the caller's own RLS client

## Canonical commands
```
$ TBC_BUILD=2026-09-04-doorlog-caller-client npm run check
  typecheck . lint . theme:audit . rls:audit . invariant:audit . tbc . test
  Test Files  622 passed | 1 skipped (623)
       Tests  4102 passed | 15 skipped (4117)
EXIT_CHECK=0
```

## The gate bites (mutation, A38)
```
$ (mutate) getKpiForDay: const sb = await createClient();   # ignore the caller's client
$ npx vitest run src/lib/data/__tests__/doorlog.callerClient.test.ts
  x getKpiForDay never falls back to the cookie client when given one
      Tests  1 failed | 2 passed (3)
$ (restore)
      Tests  3 passed (3)
```
The mutation was confirmed APPLIED before the result was read.

## Findings

### F1 - a rep-facing read answered a wrong number with a 200

class: a data-layer function that resolves its OWN client instead of accepting the caller's,
  on a path reachable by both cookie and Bearer callers. The instance was every rep-facing
  function in doorlog.ts; the class is any data helper that chooses its own transport.
sweep: `grep -rn "await createClient()" src/lib/data src/lib/coach src/lib/brain --include=*.ts`
  and, for each hit, `grep -rl "<module>" src/app/api --include=route.ts` to test whether any
  importing route is called by the mobile app.
severity: critical - it silently reported 0 knocks and 0 sales for a day holding 8 knocks and
  5 sales, with a 200. A wrong number a rep believes is worse than an error they can report.

### F2 - the rest of the class, enumerated rather than assumed

class: the same cookie-client assumption in the other library files.
sweep: the command in F1. It returns 14 files. Their status, each checked individually:
  FIXED here - `data/doorlog`. FIXED in the previous build - `brain/index`.
  CORRECT AS-IS - `api/resolveApiAuth` and `supabase/auth-helpers` ARE the cookie path;
  `api/careAgentAuth` serves C.A.R.E agent routes the mobile app does not call.
  NOT REACHED BY THE APP, so unfixed and named - `coach/v5/debrief`, `coach/v5/memory`,
  `data/assetReadout`, `data/departments`, `data/dissect`, `data/files`, `data/meetingPrep`,
  `brain/learn`, and `getAllTimeKpi`'s other caller `coach-assessment`. None appear in the
  mobile app's 28 called routes, checked against that list.
severity: medium - none is currently reachable from the app, so none is breaking today. Each
  becomes a defect the moment a Bearer caller reaches it, which is why they are listed by name
  with the test that would catch it.

### F3 - this repository cannot demonstrate the repair

class: a defect whose proof of repair lives only in production.
sweep: after deploy, re-run the recorded measurement -
  `GET /api/coach/sales-session/door-log?date=2026-08-31` with a valid Bearer token must
  report 8 knocks and 5 sold, matching the rows the service key reads.
severity: medium - the repository cannot demonstrate it, so the claim is not made until the
  probe is re-run.
