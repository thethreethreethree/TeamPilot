# CHECK — iOS capture webm regression fix

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (11) + artifacts + residual + freshness all ✓
  Test Files  586 passed | 1 skipped (587)
       Tests  3835 passed | 15 skipped (3850)
GATE_EXIT=0
```
(+3 pickMime.ios A30 gate tests.)

## The diagnosis is from LIVE TELEMETRY (the strongest evidence)
`scripts/diag-capture-live.mjs` over `doorlog.capture_failed`: 100% of empty captures were iOS 18.7 recording as
`audio/webm;codecs=opus`, sawData=true, chunkCount=1, chunksUploaded=0, no track loss / no recorder error / not hidden.
The banner fires only when the blob is < 1024 bytes → iOS produced a webm STUB. Root cause named from data, not assumed.

## What the tests prove (A30)
- iOS picks mp4 even when webm is falsely reported supported; falls through to aac; non-iOS keeps webm-first.
- Existing recorder + captureDiag tests still pass (the iOS chunk behavior + the diag shape).

## Not unit-tested (bounded honestly)
The end-to-end capture→upload→transcribe chain is device+network shaped; the mime SELECTION is now gated, the downstream
filename derivation is a pure map (extForMime), and the re-instrumented capturedBytes will confirm real audio on the
next real pitch. The definitive proof is a founder field test on a real iPhone.

## Findings
No findings — an instrument-first fix of a regression I introduced (webm-preference on iOS), with the downstream
precondition (mp4 filename) fixed, the telemetry blindness closed, the class swept, and the lesson gated.
