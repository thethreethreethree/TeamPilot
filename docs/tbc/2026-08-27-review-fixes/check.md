# CHECK — Review fixes

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (10) + artifacts + residual + freshness all ✓
  Test Files  583 passed | 1 skipped (584)
       Tests  3824 passed | 15 skipped (3839)
GATE_EXIT=0
```

## What this covers
- The scenario auto-fetch no longer loops on the null/error/rate-limited path (ref latch, one attempt per focus).
- The coaching-material "couldn't load" state retries on reopen.
- The team-brief Day/Week toggle no longer mislabels the displayed brief (label from brief.periodLabel, not the toggle).
- Existing tests (parsePracticeScenario, parseCoachingMaterial, parseTeamBrief/labelForDays) still pass — the parse
  seams are unchanged.

## Not unit-tested (bounded honestly, A30)
All three are React effect/render fixes with no pure-function seam (a re-render loop, a fetch-on-open condition, a
label source). Checked by reasoning + typecheck; the reviews that surfaced them are the detection. A render-test
harness for these pages is a later hardening.

## Findings
No findings — three confirmed review defects fixed at the right depth, isolated, with the refuted hypotheses left
unchanged.
