# CHECK — iOS empty-capture ROOT: force chunks via requestData()

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest + artifacts + residual + freshness all ✓
  Test Files  578 passed | 1 skipped (579)
       Tests  3783 passed | 15 skipped (3798)
GATE_EXIT=0
```
(+1 test — the iOS chunk-forcing case.)

## What the test proves
- `useDoorRecorder.iosChunks.test.ts`: with a MediaRecorder whose `start(timeslice)` fires NO periodic
  `ondataavailable` (the iOS behavior), advancing one interval makes the hook call `requestData()`, which emits a
  continuation chunk — `stop().diag.chunkCount > 0`. Without the fix, `chunkCount` stays 0 (nothing until stop) and
  the recording is lost. Regression-locks the interval logic.
- The 23 existing doorlog render tests still pass — the change is additive (they mock the hook; the real-hook test
  covers the new path).

## Field proof (the real gate)
jsdom cannot reproduce iOS Safari's timeslice bug. The authoritative verification is a live iOS 18.7 device
producing a non-empty recording on a multi-minute pitch — the founder is testing on exactly that.

## Findings
No findings — the fix is grounded in the telemetry (12/12 iOS, chunksUploaded=0), additive, non-iOS is a no-op, and
the interval is cleared on stop/teardown.
