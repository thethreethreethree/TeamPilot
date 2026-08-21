# CHECK — Trend tile shows the balance ratio

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  547 passed | 1 skipped (548)
      Tests  3607 passed | 15 skipped (3622)
EXIT: 0
```

All six gates exit 0 (incl. theme:audit). Client-only tile change; no sales/server change.

## Findings
**No findings.** Fetch/render glue; the swapped stat reads the balancedRatio the route already returns.
