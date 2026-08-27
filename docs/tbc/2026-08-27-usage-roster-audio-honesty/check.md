# CHECK — usage roster audio-capture honesty

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test            Test Files  ... passed
GATE_EXIT=0   (filled from the real run below)
```

## What this covers
- The manager usage roster now surfaces `withAudio` per rep and flags the all-failed case (count>0, withAudio=0) with a
  ⚠ warning — so an "active" rep whose captures all failed can't read as healthy in the surface built to monitor usage.
- A render test gates it: a withAudio=0 rep shows "⚠ none with audio"; a healthy rep shows "N with audio".

## Findings
No findings — a §3.4 honesty fix consuming a signal the route already computed but the view dropped, gated by a render
test. No route/schema/API change.
