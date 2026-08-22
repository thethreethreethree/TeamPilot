# CHECK — DoorLog iOS zero-audio fix

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  564 passed | 1 skipped (565)
      Tests  3701 passed | 15 skipped (3716)
EXIT: 0
```

(Targeted: DoorLog + pitch suites 24 files / 85 tests pass — no regression. No new tests: the recorder changes are
device-confirmed mic glue; the suites guard against regression.)

## What the tests prove
- **No regression:** the full DoorLog render suite + the pitch stitch/worker suites (24 files, 85 tests) pass with
  the cloned-analyser + explicit-mimeType recorder and the content-type-preserving stitch.
- The recorder changes themselves are mic glue (MediaRecorder / getUserMedia / track.clone) — device-confirmed,
  not jsdom-testable; the render tests mock the recorder, so they guard the CONSUMER, not the glue.

## Honest limit
This is a DATA-LED fix for a cause (iOS AudioContext starving the recorder) that the field events fit but only a
real iOS device + the continued `doorlog.capture_failed` diag can CONFIRM. iOS being already-100%-broken bounds the
downside (the change can't regress iOS; non-iOS is untouched webm). The chunked-mp4 stitch (do iOS mp4 fragments
concatenate to a transcribable recording?) is the specific device-test confirmation point.

## Findings
**No findings.** Low-downside + scoped to iOS; non-iOS webm pipeline unchanged; the diag stays as the standing
gate. Class flagged (A26): live/meeting share the AudioContext-on-mic pattern (STT-load-bearing — data-led if
their diags show it).
