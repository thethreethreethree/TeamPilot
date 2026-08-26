# CHECK — Practice engine

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (11) + artifacts + residual + freshness all ✓
  Test Files  580 passed | 1 skipped (581)
       Tests  3795 passed | 15 skipped (3810)
GATE_EXIT=0
```
(+5 parsePracticeReview tests; existing roleplay parseReview/route tests unchanged and passing.)

## What the tests prove (parsePracticeReview — the scorecard honesty seam)
- Returns null on malformed / empty (starved) JSON → the route 502s, never a blank scored card.
- Keeps applied:false as a VALID honest outcome (rep never reached the skill), not a parse failure.
- Clamps an out-of-range score to 0-100 and rounds a fractional one (an LLM can't emit a wild/fractional grade).
- Defaults a missing/non-numeric score to 0 and a missing nextRep to empty (no fabrication).
- Echoes back OUR focus, never a model-invented one.
- Existing roleplay tests (parseReview, route) still pass — the default no-focus path is unchanged.

## Not unit-tested (bounded honestly)
The prompt text (practiceReviewSystem / the focus seed line) and the page's seed-in/scorecard-out wiring are
integration-shaped; the LLM output is guarded by the tested parser, and the default review path is covered by the
existing parseReview + route tests. The scored branch is a thin wrapper over the same LLM caller as its sibling.

## Findings
No findings — a single-branch extension of a tested engine: it reuses the turn loop + dissectCoachV5 unchanged, keeps
the default review byte-for-byte, adds no schema/persistence, and gates the scorecard honesty (null/clamp/applied) with
unit tests. §A18 respected: the score is self-data, never a leader-facing ranking.
