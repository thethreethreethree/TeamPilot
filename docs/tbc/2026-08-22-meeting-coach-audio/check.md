# CHECK — Meeting call-audio durability

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  541 passed | 1 skipped (542)
      Tests  3572 passed | 15 skipped (3587)
EXIT: 0
```

All six gates exit 0. Client-only change (`useMeetingCoaching.ts`); no sales/server files touched. The reused
server routes + crons already carry their own tests (audio-chunk route, stitchSessionAudio, the crons).

## Findings
**No findings.** Honest boundary (not a defect): the recorder logic lives in the mic/MediaRecorder React hook,
not unit-testable in node — reasoned + typecheck/lint-clean, device-confirmed with the rest of the client. The
reconnect-recorder gap (post-mic-track-loss audio not recorded) is a KNOWN, documented MVP limit, not a defect —
recorded as a residual.
