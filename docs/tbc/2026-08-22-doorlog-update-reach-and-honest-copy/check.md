# CHECK — DoorLog update-reach + honest audio-dropped copy

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  553 passed | 1 skipped (554)
      Tests  3636 passed | 15 skipped (3651)
EXIT: 0
```

All gates exit 0. Client-only change (recorder flag, event, copy, VersionWatcher listener); no server change.

## What the tests prove
- The upload-failure fallback saves the outcome as a knock AND shows the honest "the recording couldn't be
  saved" note (NOT "no audio"); the no_capture path still says "no audio was recorded".
- No regression across the doorlog + VersionWatcher suites.

## Honest limit (A38)
The auto-reload REACH (a stale active rep updating at the next between-doors gap) exercises the live
`/api/health` compare + `window.location.reload()`, which cannot run headless. That is confirmed on-device:
deploy, keep an old app open + knocking, and verify it reloads to the new build at a door gap without a manual
refresh. (Meanwhile: a full close+reopen pulls the fix immediately.)

## Findings
**No findings.** Reuses the tested VersionWatcher guards; the copy change is a pure string decision locked by a test.
