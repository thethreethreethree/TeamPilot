# CLOSURE — reopen/revisit throttle bypass

## What shipped
The secondary forced auto-update now fires reliably on a reopen/revisit even within 30s of the last check: a
genuine revisit (`document` hidden→visible) bypasses the 30s version-check throttle, so `check()` runs fresh and
routes to `scheduleReload`. Ordinary focus churn still throttles. All safety guards (recording hold, once-per-commit
loop guard, the pure `shouldForceReload`) are unchanged — the bypass only affects the throttle. Follow-up to
e6f17db3.

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 401 passed | 1 skipped (402); Tests 2764 passed | 15 skipped (2779)
EXITCODE=0
```
`shouldForceReload`: 7 tests unchanged + passing (the bypass doesn't touch the guard decision). The
throttle/visibility wiring is React/DOM (node-untestable, A30 honest).

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "The revisit → bypass → check → scheduleReload wiring is React/DOM (visibilitychange, sessionStorage, body flag) and untested in node.", "why_skipped": "Standing repo constraint; the safety-critical branch (shouldForceReload) is pure + tested, and the bypass is a single boolean threaded to skip the throttle — thin glue.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T12:10:00Z", "outcome": "Opened + assessed: accepted — the guards are tested; the founder's device (reopen a stale PWA within 30s) is the live check." },
  { "id": "R2", "item": "A rapid background→foreground loop could now issue a health fetch each revisit (no throttle on revisit).", "why_skipped": "checkingRef prevents concurrent fetches, /api/health is a tiny no-store GET, and the once-per-commit reload guard prevents any reload spam; the reliability gain outweighs an occasional extra cheap GET.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T12:11:00Z", "outcome": "Opened + assessed: acceptable — bounded by checkingRef + the reload guard; a genuine reopen is not a tight loop." }
]
```

## Un-named reliance
- Relies on `visibilitychange` (hidden→visible) being the reopen signal (unchanged from e6f17db3) and on the
  scheduleReload guards holding regardless of how check() was reached.

## Status
Complete; full gate exit 0 (pasted above). Commit the VersionWatcher + this TBC dir with explicit paths, then push.
