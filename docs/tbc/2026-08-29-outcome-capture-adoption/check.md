# CHECK — outcome-capture adoption prompt

## Gate — the canonical command (A38)
```
$ npm run check   # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:* — pass
> test   Test Files 595 passed | 1 skipped ; Tests 3939+ (unchanged suite)
PIPE_EXIT=0
```

## What is / isn't tested
- Tested (already): the write path `POST /[id]/outcome` → column + event (route.test).
- UNTESTED (founder-visual-verify): the intercept UI flow — this is a large client page with no jsdom render
  harness (same posture as the other Sales-Coach pages). Verify by tapping Start Next Door with no outcome →
  the prompt appears → an outcome tap records + proceeds; Skip proceeds without one. Typecheck is clean.

## Findings
No findings. The build reuses the existing, tested write chokepoint; the only new surface is a skippable UI
intercept, honestly labelled visual-verify rather than asserted green.
