# CHECK — new metrics on the manager roster

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
- The team route tests pass (10/10), INCLUDING the A18 privacy guard — which flagged the 3 new keys and forced a
  conscious allow-list update; its raw-score-leak assertions (91/42/"payload" never in the response) still pass,
  proving the new fields are aggregates, not a score leak.
- typecheck: the 3 MetricResults flow from compute → route → TeamAgent → roster columns → CSV.

## Not unit-gated (founder visual-verify)
- The roster rendering the Objections + Uptake columns over live data. The per-agent computation + the privacy
  contract ARE unit-gated.

## Findings
No findings — reuses the existing payload read (no new query), matches /me's functions/gates (cross-view
consistency), and preserves the A18 privacy contract (aggregates only), with the guard updated consciously.
