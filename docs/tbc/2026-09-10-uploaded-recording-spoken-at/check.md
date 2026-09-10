# CHECK - carry the recording's own timing into spoken_at

## Findings

### F1 - the diarizer's per-segment offset was dropped at the upload boundary
class: silent-data-loss (a value that exists is discarded at a boundary, and nothing downstream can tell the difference between discarded and absent)
sweep: `grep -rn "spoken_at\|spokenAt" src/ --include=*.ts` then walk diarizer -> upload-recording -> label-transcript -> agentWpm one hop at a time
severity: high
`transcribeWithDiarization` builds every segment as `{ speakerId, text, start }`, `start` being seconds into
the audio from the provider's per-word timestamps. `buildSpeakerResponse` typed its input as
`{ speakerId, text }`, so the offset never reached the client, `label-transcript` had nothing to write, and
every uploaded recording landed with `spoken_at = null`. `agentWpm` needs three clean TIMED agent turns, so
the Coach Assessment "speed" skill has never scored an uploaded call - from the web OR from the native app.

Nothing failed anywhere: the upload, the transcript and the label were all correct, and the skill's
"not enough sessions yet" is the same sentence a rep with genuinely too few sessions sees. That
indistinguishability is why it survived. Fixed by this build; see remediate.md.

### F2 - the app spec's premise about who captures the timing is wrong
class: spec-premise-wrong (an instruction written for one client's architecture, applied to another's)
sweep: `grep -rn "segments\|spokenAt" src/ --include=*.ts --include=*.tsx` in the native app repo, to see whether it POSTS transcript segments at all
severity: medium
The native app's REV1 doc 04 instructs the APP to stamp `spokenAt` per turn, on the premise that the app is the
capture client. It is not: the app uploads audio, the server transcribes, and the app posts no transcript
segments anywhere - it only reads them. Following the doc literally would have produced app code with nothing
to stamp and left the real drop, one boundary above, untouched.

Closed on the record rather than by a code change here: the doc belongs to the app repo, and the correction is
simply that the fix site is the server boundary in F1. The app's genuine part - carrying the offset back with
the speaker choice - is done in the app repo and pinned there.

## What was NOT changed, on purpose
The live-coaching path already stamps `spokenAt` in the browser at capture; it is untouched. The base for an
uploaded call is `coaching_sessions.started_at`, not a client-supplied recording start - the offsets are
relative and `agentWpm` reads GAPS, so a base a few seconds out changes no score, and using the session's own
row avoids trusting a second clock for a number that does not need one.

## Mutation proof (A30)
```
$ # spokenAtFor mutated: an unknown offset falls back to the base instead of null
$ npx vitest run src/lib/coach/v5/__tests__/segmentTiming.test.ts "src/app/api/coach/sales-session/[id]/label-transcript"
 x returns null rather than stamping a segment with the start of the call
 x leaves a segment with no offset unstamped rather than at the start of the call
      Tests  2 failed | 16 passed (18)
EXIT_MUTATED=1
$ # source restored
      Tests  18 passed (18)
EXIT_RESTORED=0
```
The mutation was confirmed to have applied before the run - the replace asserts and fails loudly otherwise, and
a mutation that silently does not apply proves nothing.

## Targeted suite
```
$ npx vitest run "src/app/api/coach/sales-session/[id]/label-transcript" src/lib/coach/v5/__tests__/segmentTiming.test.ts
 Test Files  2 passed (2)
      Tests  18 passed (18)
EXIT_TARGETED=0
```

## Canonical command
```
$ TBC_BUILD=2026-09-10-uploaded-recording-spoken-at npm run check
  typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
  theme:audit      - No theme-bound leaks. (1643 files scanned)
  rls:audit        - Tables without RLS: 0
  invariant:audit  - Files scanned: 1012 · Violations: 0
  tbc:docs OK  tbc:manifest OK  tbc:artifacts OK  tbc:residual OK  tbc:freshness OK
  Test Files  634 passed | 1 skipped (635)
       Tests  4188 passed | 15 skipped (4203)
EXIT_CHECK=0
```

## Migration held for the founder (A34)
`0249_replace_transcript_spoken_at.sql` is BUILT and NOT applied. It is not required for the fix to work: the
FIRST label of an uploaded call writes through `appendTranscriptSegment`, which already accepts `spokenAt`, so
the pace skill starts working the moment this deploys. 0249 only extends the same timing to the RECOVERY
re-transcribe path, and until it is applied that path behaves exactly as it does today.
