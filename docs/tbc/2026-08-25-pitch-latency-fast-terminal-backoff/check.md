# CHECK — cut after-pitch latency: fast-terminal permanent failures + shorter retry backoff

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc:docs ✓  tbc:manifest ✓ (10 entries)  tbc:artifacts ✓  tbc:residual ✓ (R1 opened)  tbc:freshness ✓
  Test Files  575 passed | 1 skipped (576)
       Tests  3774 passed | 15 skipped (3789)
GATE_EXIT=0
```
(+5 tests vs the prior build — the 7s backoff schedule, isPermanentFailure permanent/transient branches, and the
worker permanent-terminal / transient-backoff cases.)

## What the tests prove
- `backoffMs`: the new 7s schedule (7,14,28,56s; caps at 1h) — a regression here means the base drifted.
- `isPermanentFailure`: TRUE for bad-audio-content (invalid_audio / invalid_content / file corrupted) and missing
  config (no brain row / company not found); FALSE for 5xx / timeout / "retryable" / stitch-list errors — so a
  transient failure keeps its retries and is never killed early.
- worker: a permanent error terminalises on attempt 1 with NO backoff write; a transient error does NOT terminalise
  and DOES write a backoff run_after (still retries).

## Findings
No findings — the fix is grounded in the measured latency data, the classifier is conservative (transient errors
keep retrying), and the class boundary (the worker's single retry path) is swept. Cron-gap outliers + iOS capture
root are out of scope (flagged).
