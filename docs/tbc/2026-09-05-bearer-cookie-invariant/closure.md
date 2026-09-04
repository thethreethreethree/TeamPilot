# CLOSURE - INVARIANT 26, the Bearer/cookie-client guard

## What shipped
One invariant, added to the existing audit, that fails when a Bearer-accepting route
transitively reaches a library resolving its own cookie client.

This class cost four defects in two days - the mobile app's AI features, the door
tracker's confident zero, roleplay's bodiless 500, and the C.A.R.E extension coach
running with no memory. Every one was found by hand, three after a person noticed,
and the sweeps in between kept missing it for one reason: they read a route's DIRECT
imports and stopped. Two of the four hid behind a single extra hop.

A30 says a lesson recorded only in prose will return, and that a fix is not complete
until the class is encoded in a gate that fails without the author's cooperation.
Three builds closed instances of this class in prose. It returned each time. This is
the gate.

## Verification (A38)
```
$ TBC_BUILD=2026-09-05-bearer-cookie-invariant npm run check
  typecheck . lint . theme:audit . rls:audit . invariant:audit . tbc . test
  invariant audit: 997 files scanned, 0 violations (INVARIANT 26 included)
  tbc: docs, manifest, artifacts, residual, freshness -- five of five clean
  Test Files  623 passed | 1 skipped (624)
       Tests  4106 passed | 15 skipped (4121)
EXIT_CHECK=0
```

The guard was mutation-proven against the real defect: removing
`src/lib/coach/v5/memory.ts` from the allowlist makes the audit report exactly
`src/app/api/care/extension/coach/route.ts` (transcript in check.md).

## The un-named reliance
- Relies on static imports. A dynamic import or an injected dependency is invisible
  to it; declared as F3 rather than left implicit.
- Relies on the allowlists staying honest. Each entry carries a reason and, where one
  exists, the test that gates it - so an exclusion reads as a claim someone made.
- Relies on the Bearer regex naming the real mechanisms. `careAgentAuth` is excluded
  by name with a self-test, because including it made the analysis circular.

## Residual (A36 - explicit)
```json
[
  {
    "id": "INV26-R1",
    "item": "Seven library modules still resolve their own cookie client. None is reachable from a Bearer route today, which the guard now checks continuously rather than by hand.",
    "why_skipped": "They are not broken, and the guard will report the moment one becomes reachable - which is the outcome the by-hand sweep was trying to buy.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-05T03:25:00+08:00",
    "outcome": "OPEN by design - the guard is the watch. Fix each only when it is actually reached."
  },
  {
    "id": "INV26-R2",
    "item": "The guard cannot follow a dynamic import, a string-keyed dispatch table, or an injected dependency.",
    "why_skipped": "None of the four incidents took that shape, and widening a static analyser to chase shapes that have never occurred trades precision for noise (A33).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-05T03:25:00+08:00",
    "outcome": "OPEN - if a fifth instance ever arrives by a runtime-only path, that is the evidence that would justify widening it."
  }
]
```
