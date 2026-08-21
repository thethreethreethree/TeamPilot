# CHECK — Meeting hook start() Stop-during-setup guard

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  541 passed | 1 skipped (542)
      Tests  3572 passed | 15 skipped (3587)
EXIT: 0
```

All six gates exit 0. Client-only, one-line-pattern change to `useMeetingCoaching.ts`; no sales/server change.

## Findings
**No findings.** Honest boundary: the guard lives in the mic/WS React hook, not unit-testable — device-confirmed,
and it mirrors the sales hook's existing stop-guard behavior. It is a NO-OP in the normal path (stoppedRef is
false during a fresh start and a reconnect), so it cannot affect a normal session.
