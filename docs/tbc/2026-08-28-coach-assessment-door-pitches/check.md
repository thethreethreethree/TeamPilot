# CHECK — door pitches feed the Coach Assessment

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test            Test Files  591 passed | 1 skipped (592)
                  Tests  3869 passed | 15 skipped (3884)
GATE_EXIT=0
```

## What this covers
- `aggregateCoachingContent`: pitch strings → Doing Well/Focus; dissects+pitches interleave newest-first; a pure
  pitcher gets content; malformed rows degrade without throwing (4 new tests).
- typecheck: the route/page consume the new `pitchCount` + merged content; `aggregateDissectContent` still serves
  my-training unchanged.

## Live end-to-end check (§1.5.1 — does it work)
Queried live: Moses 36 pitch_analyses with real coaching text now merge into his card; the founder 3; blank reps have
0 pitch_analyses (no assessed pitches yet — an upstream capture matter, not this change). Confirms the manager view
will populate from door work.

## Findings
No findings — the merge is gated + live-verified; the fix executes the founder's chosen direction (feed door pitches
in) and wiring (merge the text).
