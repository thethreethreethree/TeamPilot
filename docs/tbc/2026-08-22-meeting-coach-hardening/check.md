# CHECK — Meeting Coach client hardening

## Gate — the canonical command (A38)

The theme leak proves A38's point directly: my first pass ran only a scoped `tsc + eslint` (green), which does
NOT run `theme:audit`. Running the FULL canonical command caught the hard-coded-zinc leak the subset couldn't:

```
$ npm run check
 Test Files  541 passed | 1 skipped (542)
      Tests  3572 passed | 15 skipped (3587)
EXIT: 0
```

All six gates exit 0 — including `theme:audit`, now green after the semantic-token conversion. No sales/server
files touched.

## Findings
**No findings** remaining. The three defects the audit surfaced are fixed (reconnect leak, error/stop dead-end,
theme leak). Honest boundary (not a defect): the two logic fixes live in the mic/WS React hook, which is not
unit-testable in node — they are reasoned + typecheck-clean, and confirmed on device with the rest of the client
(the standing limit for this class, same as useLiveCoaching). The theme fix IS gate-covered (theme:audit).
