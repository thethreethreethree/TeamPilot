# CHECK — AI-written practice scenarios

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (10) + artifacts + residual + freshness all ✓
  Test Files  582 passed | 1 skipped (583)
       Tests  3817 passed | 15 skipped (3832)
GATE_EXIT=0
```
(+5 parsePracticeScenario tests.)

## What the tests prove (parsePracticeScenario — the honesty seam)
- Parses a valid scenario; tolerates a ```json fence.
- Returns null on malformed / non-object / empty JSON → the caller falls back to the plain focus seed (§3.4).
- Returns null when there is neither a persona nor a situation (nothing usable).
- Keeps a situation-only scenario (a missing title/persona is not fatal).

## Not unit-tested (bounded honestly)
The route + the setup-screen fetch/seed are integration-shaped; the generation is guarded by the tested parser, the
route mirrors the roleplay route's auth/fence/maxDuration, and the fallback keeps practice working when generation fails.

## Findings
No findings — a best-effort, corpus-grounded generation with an honest null fallback, a fenced + gated LLM route, and a
test-locked parser. The scored review and the practice event write are unchanged.
