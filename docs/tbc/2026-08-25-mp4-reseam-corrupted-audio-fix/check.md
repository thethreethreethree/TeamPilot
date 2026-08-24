# CHECK — ElevenLabs "invalid_audio / corrupted": mp4-aware reseam + ground-truth capture

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest + artifacts + residual + freshness all ✓
  Test Files  575 passed | 1 skipped (576)
       Tests  3760 passed | 15 skipped (3775)
EXIT: 0
```
(+5 tests vs the prior build's 3755 — the mp4 detector, container-aware header, second-init finder,
describeAudioBytes, and the mp4 reseam-stops case.)

## What the tests prove
- **`startsWithMp4InitSegment`**: matches an `ftyp` box (type bytes @4), rejects EBML, a `moof` continuation
  fragment (NOT a new recording), and short buffers. **`startsWithNewRecordingHeader`**: webm OR mp4, nothing else.
- **`findSecondInitSegment` / `describeAudioBytes`**: a single recording → -1 / no "bad-concat"; a webm+webm or
  mp4+mp4 concatenation → the second-init offset is reported (the fingerprint the fix prevents).
- **Reseam behavior**: `stitchSessionAudio` stops at a mid-stream mp4 `ftyp` (iOS recreated recorder) and keeps
  segment 1 — the twin of the existing webm-reseam test. Fails if the reseam reverts to webm-only.
- **A26/DRY**: both stitch paths import the same container-aware helper; the pitch/worker tests re-run unbroken,
  confirming the shared fix didn't regress either path.

## Findings
No findings — the fix closes a real reseam-class defect and ships the ground-truth capture that confirms it.
