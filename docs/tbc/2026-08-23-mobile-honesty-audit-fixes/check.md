# CHECK — mobile Sales Coach honesty + contrast fixes (F4 / F4b / F5)

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  Test Files  567 passed | 1 skipped (568)
       Tests  3723 passed | 15 skipped (3738)
EXIT: 0
```

(+2 vs the prior 3721: PitchDetail 500→retryable, macro-home Pitches "—"-on-fail. Note: the
`invariant-audit.test.ts` reachability case is load-sensitive — it flaked once under full-suite
concurrency [audit still reported Violations 0], passed standalone in 3.0s, and passed clean on the
recorded EXIT-0 run above.)

## What the tests prove
- **F4 (`PitchDetail.render.test.tsx`):** a 500 renders "this is an error, not a missing pitch" + a **Retry**
  button and does NOT render the permanent "isn't available"; the back-nav stays intact. The existing 404 case
  still shows "isn't available" (only a real 404 is "missing").
- **F4b (`macroCardVisibility.render.test.tsx`):** rendering the real home with the dashboard fetch returning
  `!ok` shows the mobile Pitches pill as "—", not "0".

## Honest limit
F5 is a color-token swap (visual): it is confirmed by reading the tokens (`text-muted`/`text-secondary` are the
theme-aware tokens used throughout the `bg-base` mobile area, legible in both themes) rather than a per-color unit
test — that class is guarded at the tooling level (`contrast-batch.mjs`), and a hardcoded-color assertion would be
brittle. The eyeball confirmation is a light-mode go-live check.

## Findings
No findings. The 3 fixed here are the clear, low-risk, class-matching bugs; the 3 design decisions (F1/F2/F3) are
surfaced to the founder via a picker, not silently dropped.
