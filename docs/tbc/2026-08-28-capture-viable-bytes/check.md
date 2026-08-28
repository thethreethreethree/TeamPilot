# CHECK — capture viability on byte volume

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  593 passed | 1 skipped (594)
        Tests  3912 passed | 15 skipped (3927)
PIPE_EXIT=0
```

## The live evidence (why this fix exists)
Read-only audit of `pitches` (temp script since deleted):
```
last 7 days: 45 pitches, 34 complete, 11 FAILED (24%)
error: ElevenLabs STT 400 invalid_audio "File is corrupted" [audio size=5 ct=audio/webm]
all 11 failures = webm; the stored audio file is 5 bytes (an empty stub)
```
isCaptureViable returned true for these (chunksUploaded>0), so 5-byte stubs became pitches that died at STT.

## What the tests lock (A30)
- A streamed stub (capturedBytes=5/200/0 with chunksUploaded≥1) is NOT viable — the 24% bug closed.
- A real recording (capturedBytes ≥ 1KB) stays viable even with a tiny final blob.
- Fallback: capturedBytes unknown/null → old chunk/blob behavior (backward compatible).

## Not unit-gated (founder visual-verify)
- The end-to-end effect on a real iOS device (a stub now yielding a re-record + logged knock, not a pitch). The
  pure-function gate + the DoorLog capturedBytes plumbing are unit-gated + typechecked.

## Findings
No findings on the fix. Open: the ROOT cause (why the stub is produced — webm-vs-mp4) is a separate critical
residual; this fix stops the doomed-pitch symptom and makes the failure honest.
