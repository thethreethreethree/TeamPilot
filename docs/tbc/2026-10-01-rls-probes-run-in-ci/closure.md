# CLOSURE - RLS probes run in CI

## What is true now

Every RLS probe in `scripts/sql/probes/` runs in CI on a fresh copy of the fully migrated database and fails
the build if a policy stops doing what the code beside it assumes. 0267's undo rule is the first one.

## The finding

A probe that prints its results is a check that only works when someone reads it. Ending it in assertions
made it a gate, and the migration audit already had the database it needed.

## Residual

```json
[
  {
    "id": "R1-ci-first-run",
    "item": "PASS 3 has run locally against postgres:16-alpine, not yet in CI.",
    "why_skipped": "CI runs on the next push to main; this commit is that push.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-10-01T05:00:00Z",
    "outcome": "CLOSED. CI run 36817572053 for 5ce6df9a: completed success, step Migration apply audit success (05:00:26-05:00:54Z), read from the public GitHub API."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
