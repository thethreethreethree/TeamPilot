# CLOSURE — Meeting hook start() Stop-during-setup guard

## What shipped
The zero-risk half of the review's shared `start()`-race finding: `useMeetingCoaching.start()` now honors
`stoppedRef` after each setup await, so a Stop tapped mid-startup tears down cleanly instead of building a zombie
"live" session. Client-only; full `npm run check` exit 0 (3572 tests); no sales/server change.

## The un-named reliance
- **Device confirmation.** The guard is in the untestable hook; it's a no-op in the normal path and mirrors the
  sales hook's stop behavior, but the meeting hook's specific wiring is confirmed on a real run.

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "sales-hook-same-race-unfixed",
    "item": "useLiveCoaching (the LIVE sales hook) has the identical start()-checks-only-unmountedRef race, still unfixed.",
    "why_skipped": "It touches the load-bearing, untestable sales business; fixing it under the build guard without founder awareness is the §5 builder-under-pressure trap. It is a low-frequency race (Stop during the 1-2s startup) that is recoverable (a second Stop tears the zombie down).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T00:41:00+08:00",
    "outcome": "Examined: the sales fix is the same one-line-pattern change (add stoppedRef to the three post-await checks), so it is trivial and safe in isolation — but any untestable change to the live sales hook should ship with founder awareness + a device run, not silently under an autonomous guard. FILED for a coordinated founder-aware pass; deliberately not done here. The meeting and sales halves diverging is harmless (the meeting hook is simply more defensive)."
  }
]
```
