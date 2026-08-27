# CHECK — Objections per session

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3879 passed | 15 skipped (3894)
PIPE_EXIT=0
```

## What the tests lock (A30)
- `compute.test.ts` — objectionInputFromPayload reads the stored tally + clamps resolved ≤ raised; returns NULL
  (excluded, not a false 0) for a no-tally / old-moments / malformed payload; objectionsPerSession avg + gate;
  objectionResolutionRate = resolved ÷ raised; the honesty gate (0 objections raised → building, NOT 100%); the
  MIN_SESSIONS gate on both.
- `salesMoments.test.ts` — parseMoments extracts the whole-call tally (clamping resolved ≤ raised); objections is
  null when the model omits it (so the session is excluded from the KPI, not counted as a false 0).

## Not unit-gated (founder visual-verify)
- The LLM producing a SENSIBLE objection tally over a real transcript (jsdom has no live model). The parse + compute
  + honesty gates ARE unit-gated. The two tiles rendering on the /kpi page over live data is visual-verify.

## Findings
No findings — the metric reads a real whole-call tally (not the hero-moment undercount that the mid-build
verification refuted), and every path that lacks a tally degrades to an honest "building", never a fabricated
count or a false 100% resolution.
