# BUILD — reopen/revisit bypasses the version-check throttle

## Feature inventory
### The secondary auto-update reliably fires on reopen, even within 30s of the last check
- write-path: none (client update mechanism). N/A.
- read-path: `check(autoReload, bypassThrottle)` reads `/api/health` and skips the 30s throttle when
  `bypassThrottle` is set; the visibility handler passes it on a genuine revisit (`check(revisited, revisited)`),
  so a reopen always checks fresh and routes to `scheduleReload → shouldForceReload`. Ordinary focus churn still
  throttles. Exercised by the unchanged 7 `shouldForceReload` guard tests (loop + recording guards intact).

## Files changed
- src/components/system/VersionWatcher.tsx — add `bypassThrottle`; the revisit path passes it.

## Holistic (§1.5.1)
Revisit-only bypass; mount + ordinary focus unchanged; all `scheduleReload` safety guards (recording hold,
once-per-commit loop guard) untouched. Follow-up reliability fix to e6f17db3.
