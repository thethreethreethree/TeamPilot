# CHECK — Fold balance into the trend

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  547 passed | 1 skipped (548)
      Tests  3607 passed | 15 skipped (3622)
EXIT: 0
```

All six gates exit 0. Pure aggregate change + 1 test; the trend route + tile are unchanged (structural typing
ignores the extra `balancedRatio` field they don't read). No sales/server change.

## Findings
**No findings.** The 3-signal direction is tested (balance-alone-improving; the pre-balance improving/declining/
flat cases still pass because a missing ratio counts as no-change). Honest boundary: the direction heuristic +
DOMINANCE_PCT threshold remain PROPOSED for founder adjustment — isolated in the pure aggregate + speakerBalance.
