# CHECK — Follow-up + Sales cycle on the roster

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3891 passed | 15 skipped (3906)
PIPE_EXIT=0
```

## What this covers
- Team route tests pass (10/10) INCLUDING the A18 privacy guard, which enforces the exact exposed key-set; its
  raw-leak assertions still pass, proving the 2 new fields are aggregates, not a data leak.
- typecheck: the 2 MetricResults flow compute → route → TeamAgent → roster columns → CSV; client_label added to the
  dynamic session select (both the with- and without-audio-column variants).

## Not unit-gated (founder visual-verify)
- The roster rendering the Follow-up + Cycle columns over live data. The per-agent computation + privacy contract
  ARE unit-gated.

## Findings
No findings — reuses the existing session read (no new query), matches /me's functions/gates, preserves A18.
