# CHECK — Meeting Coach client review-fix pass

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  541 passed | 1 skipped (542)
      Tests  3572 passed | 15 skipped (3587)
EXIT: 0
```

All six gates exit 0. Client-only change (`useMeetingCoaching.ts` + `MeetingCoachingPanel.tsx`); no sales/server
files touched.

## Findings
**No findings** remaining in this pass — the four review findings are fixed. The fifth item the review flagged
(`start()` checking only `unmountedRef`, not `stoppedRef`, after its awaits) is an INHERITED shared pattern —
`useLiveCoaching` has the identical behavior — so it is NOT a meeting-specific regression; left aligned with the
sales hook rather than diverging one side. Honest boundary: the fixes live in the mic/WS React hook, not
unit-testable — reasoned + typecheck/lint-clean, device-confirmed (same standing limit as `useLiveCoaching`), and
each mirrors a sales-hook guard already proven on real hardware.
