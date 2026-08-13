# CHECK — atomic-replace + hardening fixes

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings (from the adversarial review of commit 812c2ce3 — all remediated here)

### F1 — auto-recover destroy-then-fail: delete succeeds, append fails, still reports "recovered"
file+line: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` (pre-fix delete-then-append + the
unconditional `status:"recovered"`). appendTranscriptSegment swallows DB errors, so a transient failure after a
successful delete destroys the real agent transcript (or leaves a locked partial) while claiming success.
class: data-integrity / honesty (destroy-then-partial-write + false success).
severity: high (an automatic, no-tap path deleting a §3.1 data asset).
read-path: fixed by the atomic `replace_session_transcript` RPC (delete+insert in one transaction) + `recovered`
only on `ok`.
sweep-command: `grep -rn "replaceSessionTranscript\|status.*recovered" src/app/api/coach/sales-session/\[id\]/auto-recover/route.ts src/app/api/coach/sales-session/\[id\]/label-transcript/route.ts`
— confirms both overwrite paths use the atomic replace and never report a false success.

### F2 — heal fires alongside auto-recover on the Expert mode-reconcile
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` (the heal `else-if`, keyed only on
`autoGenAttemptedFor`). On load#2 the auto-recover `if` is skipped (its latch is set) and the heal fires an LLM
re-gen on the same one-sided transcript.
class: waste / KPI pollution (double LLM call + duplicate after_pitch_summary_generated event).
severity: medium.
read-path: the heal `else-if` now also requires `autoRecoverAttemptedFor.current !== id`.
sweep-command: `grep -n "autoRecoverAttemptedFor.current !== id" src/app/dashboard/sales-coach/\[id\]/after-pitch/page.tsx`
— confirms the shared latch guards both the auto-recover and the heal branch.

### F3 — cross-match can invert agent/customer on a polluted known-agent set
file+line: `src/lib/coach/v5/autoSpeakerAssign.ts` (the cross-match decide condition).
class: honesty / mis-attribution (a confident wrong canonical label).
severity: medium (plausible; depends on live-mislabel frequency).
read-path: decide only when the runner-up is below the similarity floor; two clusters both clearing → decline.
sweep-command: `grep -n "secondSim < CROSS_MIN_SIM" src/lib/coach/v5/autoSpeakerAssign.ts`
— confirms the separation guard.

### F4 — a transient STT failure permanently burns automatic recovery
file+line: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` (marker claimed before STT, never
released on a transient 502).
class: availability (one-shot automatic path against infra flakiness).
severity: low (manual card remains).
read-path: `releaseMarker()` on the download/diarization 502 paths.
sweep-command: `grep -n "releaseMarker" src/app/api/coach/sales-session/\[id\]/auto-recover/route.ts`.

### F5 — video sessions burn a guaranteed-to-decline diarization
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` (`afterPitchNeedsAutoRecover` not gated on
context).
class: cost (a wasted STT batch per video session).
severity: low.
read-path: the trigger is gated on `!isVideoSession` (`context === "video"`).
sweep-command: `grep -n "isVideoSession" src/app/dashboard/sales-coach/\[id\]/after-pitch/page.tsx`.

## Tests
```
$ npx vitest run autoSpeakerAssign auto-recover label-transcript
 Test Files  3 passed (3)   ·   Tests  32 passed (32)
```
The full gate result (typecheck/lint/audits/tbc/tests + exit code) is in closure.md.
