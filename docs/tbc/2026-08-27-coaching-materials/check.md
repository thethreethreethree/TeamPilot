# CHECK — Coaching materials library

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (10) + artifacts + residual + freshness all ✓
  Test Files  583 passed | 1 skipped (584)
       Tests  3822 passed | 15 skipped (3837)
GATE_EXIT=0
```
(+5 parseCoachingMaterial tests.)

## What the tests prove (parseCoachingMaterial — the honesty seam)
- Parses a full guide and caps arrays (keyMoves 4 / watchOuts 3 / exampleLines 3); tolerates a ```json fence.
- Returns null on malformed / non-object / empty JSON, and when there's nothing teachable (no overview, no keyMoves,
  no exampleLines) → the caller shows an honest "couldn't load" (§3.4).
- Keeps a guide that has key moves even with an empty overview.

## Not unit-tested (bounded honestly)
The route + the inline Learn fetch are integration-shaped; generation is guarded by the tested parser, the route mirrors
the sibling LLM routes' auth/fence/maxDuration, and a null result shows an honest state rather than breaking the tab.

## Findings
No findings — a corpus-grounded, best-effort guide with an honest null fallback, a fenced + gated LLM route, and a
test-locked parser. Practice / review / analytics paths unchanged.
