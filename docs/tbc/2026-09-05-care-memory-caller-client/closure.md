# CLOSURE - the coach memory honours the caller's own client

## What shipped
Every C.A.R.E browser-extension coach call was running with no memory of the user,
silently. `loadCoachMemory` resolved its own COOKIE client; the extension
authenticates with a Bearer token and sends none, so the read found nobody and
returned EMPTY_SNAPSHOT. `renderMemoryForPrompt` then returned null under its
"better silent than wrong" rule, and the prompt carried no `USER PATTERN HISTORY`
at all. The memory was in the database throughout.

`loadCoachMemory` now takes the caller's RLS client and the route passes the one it
already authenticated with. Not the service client: this reads a person's own event
history, where RLS and the actor filter are the access control.

This build exists only because the previous builds' residual was swept instead of
closed - and the sweep had to be rebuilt transitively first, because the method that
closed it originally is the same method that missed roleplay.

## Verification (A38)
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

The guard was mutation-proven: reverting the one line fails three named tests, two
of which describe the consequence rather than the mechanism (transcript in check.md).

## The un-named reliance
- Relies on `callerScopedDb(req)` producing a client whose `auth.getUser()` resolves
  the Bearer user. That is already how `coach/sales-session/door-log` works in
  production, observed returning real rows on 4 September.
- Relies on `db` being optional keeping the two cookie callers identical. Pinned by
  a test rather than assumed.
- The C.A.R.E extension's memory is NOT confirmed restored until this is deployed.
  Stated plainly rather than implied.
- This build does NOT claim a clean suite. One earlier run reported a single failure
  that could not be named because its output was not captured (F4).

## Residual (A36 - explicit)
```json
[
  {
    "id": "CARE-R1",
    "item": "Seven library modules still resolve their own cookie client. None is reachable from a Bearer route today; each becomes a defect the moment one reaches it.",
    "why_skipped": "Changing seven working files on a guess is the larger risk, and the durable guard needs a transitive reachability walk the invariant audit does not perform.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-05T02:45:00+08:00",
    "outcome": "OPEN - an invariant rule: a library module reachable from a Bearer-accepting route must not resolve its own cookie client. The sweep command is in check.md F2."
  },
  {
    "id": "CARE-R2",
    "item": "The suite is flaky. One run reported 1 failed / 4105 passed; the test could not be identified because the output was not captured.",
    "why_skipped": "Chasing an unnamed intermittent failure is guesswork without a captured name.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-05T02:45:00+08:00",
    "outcome": "OPEN - redirect npm test to a file on the next several runs until the failing name is caught."
  },
  {
    "id": "CARE-R3",
    "item": "The C.A.R.E extension's restored memory is unmeasured until deployed.",
    "why_skipped": "Not verifiable from the repository.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-05T02:45:00+08:00",
    "outcome": "OPEN - after deploy, call care/extension/coach with a Bearer token for an account with history and confirm the prompt carries USER PATTERN HISTORY."
  }
]
```
