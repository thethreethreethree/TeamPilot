# CHECK — session capture reliability (parts 1 + 3)

## Verification run (A38 — canonical command + exit code)
Canonical command: `npm run check`.

## Findings
### F1 — a failed live capture was UNRECOVERABLE: the recorded audio was never persisted
file+line: `src/lib/coach/v5/useLiveCoaching.ts` (records via MediaRecorder into a client blob, no upload) + `src/components/sales-coach/LiveCoachingPanel.tsx` (the only recovery UI, on the session page the Standard flow redirects away from).
class: a capture pipeline that keeps its only copy of the audio in ephemeral client state, so a downstream failure (live STT captured nothing) + a navigation loses it — "error/failure dressed as no-data", acute form (the call is gone, not just un-transcribed).
severity: critical — the founder's FIRST CLIENT reported sessions "constantly failing"; a 9m call showed "No conversation was captured" with no recovery.
sweep-command: `grep -rn "MediaRecorder\|recordingBlob\|upload-recording" src/lib/coach/v5/useLiveCoaching.ts` — confirmed the live path recorded audio but never persisted it (the upload/persist calls were absent). The UPLOAD path already persisted-before-transcribe (tested); only the LIVE path had the gap. Fixed by persisting on Stop.

## Targeted tests
```
$ npx vitest run src/app/api/coach/sales-session/[id]/upload-recording
 Test Files  2 passed (2)
      Tests  25 passed (25)
```

## Full gate
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (13) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 396 passed | 1 skipped (397); Tests 2732 passed | 15 skipped (2747)
CHECK_EXIT=0
```
