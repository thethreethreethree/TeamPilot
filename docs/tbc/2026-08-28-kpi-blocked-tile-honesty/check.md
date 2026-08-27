# CHECK — blocked-tile honesty state

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3886 passed | 15 skipped (3901)
PIPE_EXIT=0
```

## What this covers
- typecheck: the `blocked?: string` field flows through the `Metric` type, `renderMetricValue`, and the CSV row
  builder; both new branches compile.

## Not unit-gated (founder visual-verify)
- The two tiles rendering "needs prospect tracking" (muted/italic) instead of "building…", and the CSV writing the
  reason. This client page has no jsdom render harness; the change is a pure label swap gated by typecheck.

## Findings
No findings — presentation-only honesty fix; the blocked branch fires only for the 2 tiles that can't compute from
current data, and every other metric's "building"/value behavior is unchanged.
