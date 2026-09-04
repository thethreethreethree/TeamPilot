# CLOSURE - doorlog honours the caller's own RLS client

## What shipped
The door tracker was dead from the mobile app and nobody had reported it. Every rep-facing
function in `src/lib/data/doorlog.ts` built its own COOKIE client, so a Bearer caller ran
anonymous: knock writes were refused with a 500 and reads returned zeros with a 200. Measured
against production, `GET /door-log?date=2026-08-31` reported
`{doorsKnocked:0, sold:0, goBacks:0, notInterested:0}` for a day whose rows hold eight knocks
and five sales.

The five functions now accept the caller's RLS client and the four routes pass the one they
had already resolved. NOT the service client, deliberately: unlike the company-config reads in
`lib/brain`, RLS is doing real per-rep access control here, so bypassing it would widen access
rather than restore it.

This build exists only because the previous build's residual BRAIN-R1 was swept instead of
deferred (SS1.5.2).

## Verification (A38)
```
$ TBC_BUILD=2026-09-04-doorlog-caller-client npm run check
  typecheck . lint . theme:audit . rls:audit . invariant:audit . tbc . test
  Test Files  622 passed | 1 skipped (623)
       Tests  4102 passed | 15 skipped (4117)
EXIT_CHECK=0
```
The new gate was mutation-proven: reverting `getKpiForDay` to ignore the caller's client fails
`doorlog.callerClient.test.ts` by name (transcript in check.md).

## The un-named reliance
- Relies on every app-facing route resolving a client before calling these helpers. All four
  did already; the change was only to hand it over.
- Relies on `db` being optional keeping web callers identical. Pinned by a test rather than
  assumed.
- The door tracker is NOT confirmed working on the phone until the post-deploy measurement
  matches the rows. Stated plainly rather than implied.

## Residual (A36 - explicit)
```json
[
  {
    "id": "DOORLOG-R1",
    "item": "Nine library files still resolve their own cookie client. None is reachable from the mobile app's 28 called routes today, so none is broken; each becomes a defect the moment a Bearer caller reaches it.",
    "why_skipped": "Changing files that are not broken, on a guess about future routing, is a large unverified auth change. Every file is named in check.md F2 with the reachability check applied.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-04T15:56:00+08:00",
    "outcome": "OPEN - an invariant-audit rule needs reachability analysis: a data helper reachable from a Bearer-accepting route must not resolve its own cookie client."
  },
  {
    "id": "DOORLOG-R2",
    "item": "The door tracker's recovery is unmeasured until this is deployed and the probe re-run.",
    "why_skipped": "Not verifiable from the repository.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-04T15:56:00+08:00",
    "outcome": "OPEN - re-run GET /door-log?date=2026-08-31 with a Bearer token; it must report 8 knocks and 5 sold."
  }
]
```
