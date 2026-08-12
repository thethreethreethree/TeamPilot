# CHECK — recovery message honesty

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — zero-segment message misattributes a service failure to the recording (L4, honesty)
file+line: `SessionRecordingUpload.tsx` — the zero-segment branch of `applyTranscribeResponse`.
class: honesty-thesis surface copy — a service failure (STT returns no turns for good audio) reported as if the
recording were silent, undercutting capture priority #3 (indicate WHY). Same family as the recorded
`error_dressed_as_no_data` lens, at the copy layer.
severity: low (L4 copy; the audio is safe and recovery is reachable regardless) — but on the live first-client
incident surface, so worth getting right.
fix: reworded to one sentence true for both a silent upload and a service miss; never blames the recording.

## Testability (A30, honest)
This is copy inside a React client component. The repo's vitest runs in node env and cannot render React, so
there is NO unit test for this string (consistent with the standing repo constraint). The check is the full gate
below + the founder's visual confirmation on the live surface. No test is claimed that was not written.

## Full gate
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2744 passed | 15 skipped (2759)
EXITCODE=0
```
(Run before this build dir existed the gate was already green on the code change — typecheck + lint + full suite
all passed; this dir is the enforced-path TBC requirement for the copy change. The closure re-run is the record.)
