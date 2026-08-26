# CHECK — Team Training Brief engine

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (11) + artifacts + residual + freshness all ✓
  Test Files  579 passed | 1 skipped (580)
       Tests  3790 passed | 15 skipped (3805)
GATE_EXIT=0
```
(+5 parseTeamBrief tests.)

## What the tests prove (parseTeamBrief — the honesty seam)
- DROPS a repFocus naming a rep the engine didn't include (an LLM hallucinating a name never reaches the manager, §A18).
- Returns null on a brief with NO theme AND NO drill (no teachable signal — never render an empty shell as guidance, §3.4).
- Returns null on malformed JSON / empty text (never a fabricated brief); tolerates a ```json fence.
- Caps themes at 3, drill steps at 6.

## Not unit-tested (bounded honestly)
The engine's DB read + LLM call (generateTeamTrainingBrief) is integration-shaped; the threshold + honest-empty logic
is simple and the LLM output is guarded by the tested parser. The route is manager-gated (403 non-managers) like its
siblings.

## Findings
No findings — mirrors an established engine pattern (debrief/salesReview), builds from real pooled coaching signal,
refuses fabrication below threshold, and frames per-rep as a focus not a ranking.
