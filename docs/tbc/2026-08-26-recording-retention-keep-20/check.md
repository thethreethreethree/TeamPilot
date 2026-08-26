# CHECK — recording retention: keep each rep's last 20

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (10) + artifacts + residual + freshness all ✓
  Test Files  578 passed | 1 skipped (579)
       Tests  3785 passed | 15 skipped (3800)
GATE_EXIT=0
```
(9 purge-cron tests across both files, count-based.)

## What the tests prove
- Count-based purge: 21 recordings for a rep → EXACTLY the oldest (s21) is purged (bytes + chunks + pointer); s1..s20
  (the kept window) are untouched. `keepPerRep = 20` in the response.
- Malformed guard intact: a beyond-window recording with an unrecognized pointer is flagged `malformed`, NOT purged,
  and no delete is attempted (false-ok prevention preserved).
- Auth gate intact (503 unset / 401 wrong Bearer). Both purge-cron test files pass (9 tests).

## Findings
No findings — the selection changed (age → per-rep count) while every retention-integrity invariant (malformed guard,
chunk cleanup, saved-exempt, honest bounded flag) is preserved; the query is cap-safe (fetchAllPaged).
