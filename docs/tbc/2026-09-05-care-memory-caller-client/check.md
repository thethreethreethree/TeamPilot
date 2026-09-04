# CHECK - the coach memory honours the caller's own client

## Canonical commands
```
$ TBC_BUILD=2026-09-05-care-memory-caller-client npm run check
  typecheck . lint . theme:audit . rls:audit . invariant:audit . tbc . test
  invariant audit: 0 violations
  tbc: docs, manifest, artifacts, residual, freshness -- five of five clean
  Test Files  623 passed | 1 skipped (624)
       Tests  4106 passed | 15 skipped (4121)
EXIT_CHECK=0
```

One earlier run of the suite alone reported `1 failed | 4105 passed` and its output
was not captured, so that test cannot be named. Recorded as F4 rather than omitted:
this build claims the run above, not four clean runs.

## The gate bites (mutation, A38)
```
$ (mutate) memory.ts: const supabase = await createClient();   # ignore the caller
$ npx vitest run src/lib/coach/v5/__tests__/memory.callerClient.test.ts
  x never falls back to the cookie session when given a client
  x a Bearer caller gets the user's real history, not an empty snapshot
  x real history produces a prompt block; an empty snapshot produces none
      Tests  3 failed | 1 passed (4)
$ (restore)
      Tests  4 passed (4)
```
The mutation was confirmed APPLIED before the result was read. Two of the three
failures describe the CONSEQUENCE (no history, no prompt block) rather than the
mechanism, which is what makes the guard readable by whoever trips it.

## Contract check, read this session
- `renderMemoryForPrompt` returns null while `totalAnalyses < 3 && totalGraded < 5`.
  That threshold is correct for a genuinely new user and is unchanged; the bug was
  that a user with history LOOKED new.
- The test fixture uses the aggregator's REAL event kinds
  (`coach.analyze_returned` with a `principle`, `coach.message_graded` with a
  `grade`). The first draft invented plausible-looking kinds, which would have
  passed while proving nothing - caught by reading `aggregate()` rather than
  assuming it.

## Findings

### F1 - a Bearer route read a person's history through a cookie client

class: a library function that resolves its own client instead of accepting the
  caller's, on a path a Bearer caller can reach. Third instance today; the first two
  were `lib/brain` and `lib/data/doorlog`.
sweep: walk the import graph, not direct imports - a route is at risk when it
  matches `callerScopedDb|resolveApiAuth|resolveApiUserId|guardExtensionRequest|requireEntitledExtensionUser`
  AND transitively reaches a `src/lib/**` module containing `await createClient()`.
  Over 331 routes that is 35 Bearer routes, 17 reaching a cookie-only library, and
  after removing the by-design cookie front doors exactly one live case.
severity: critical for the C.A.R.E extension - not because anything broke visibly,
  but because nothing did. Every extension coach call ran with no memory of the
  user, silently, and the thing switched off is the SS3.4 accumulated-behaviour
  thesis and the SS3.6 visible-learning promise.

### F2 - the rest of the class, enumerated rather than assumed

class: the same cookie-client assumption elsewhere in `src/lib`.
sweep: the command in F1. Thirteen modules contain `await createClient()`. Status,
  each checked individually: FIXED here - `coach/v5/memory`. FIXED earlier today -
  `brain/index` (its remaining use is `unlockControlGate`, whose single caller is
  the web-only `/api/brain/unlock`), `data/doorlog`. CORRECT AS-IS - `resolveApiAuth`
  and `supabase/auth-helpers` ARE the cookie path; `api/careAgentAuth` is cookie-only
  by design and serves web dashboard routes. NOT REACHED BY ANY BEARER ROUTE -
  `brain/learn`, `coach/v5/debrief`, `data/assetReadout`, `data/departments`,
  `data/dissect`, `data/files`, `data/meetingPrep`.
severity: medium - none is reachable from a Bearer caller today, so none is broken.
  Each becomes a defect the moment a Bearer route reaches it, which is why they are
  named with the command that would find it.

### F3 - my own sweep was circular on its first run

class: an analysis whose heuristic includes the thing it is testing for.
sweep: re-read each helper named in the Bearer regex and confirm it actually
  resolves a Bearer token. `careAgentAuth` does not - `requireCareAgent()` is
  cookie-only - so counting it as a Bearer mechanism made 37 web routes look at-risk.
severity: high as a method fault, zero as a code fault. It would have produced 37
  false reports to the founder, and it is the second time in two days that checking
  one hop deep gave a confident wrong answer.

### F4 - the suite is flaky

class: a test that fails intermittently in the canonical gate.
sweep: run `npm test` repeatedly and capture output to a file each time -
  `npm test > /tmp/webtest.log 2>&1` - so the failing name survives the run.
severity: medium and UNIDENTIFIED. One run reported `1 failed | 4105 passed` and the
  output was not captured, so the test cannot be named; three later runs were clean.
  Recorded rather than dismissed: a gate that fails one run in four is a gate people
  learn to re-run instead of read.
