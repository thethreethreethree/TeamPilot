# BUILD — bad-concat recovery: salvage the first segment when STT rejects a two-init file

### the pure helper (shared, testable)
- write-path: `stitchSessionAudio.ts` — new `truncateAtSecondInitSegment(buf)`: if `findSecondInitSegment(buf) > 0`
  (a second recording-init header mid-file — the bad-concat shape) return `buf.subarray(0, at)` (the valid FIRST
  segment), else null. The doc pins the safety contract: use ONLY after STT already rejected the full buffer.
- read-path: given a webm+webm or mp4+mp4 concat the caller gets back a shorter buffer whose head is still a valid
  recording start (transcribable); given a clean single recording it gets null — so a good file is never split.

### the recovery branch (the sole live consumer — pitch worker)
- write-path: `worker.ts` — inside the EXISTING STT-rejection catch (the one that logs `describeAudioBytes`), call
  `truncateAtSecondInitSegment(dl.bytes)`; on a salvaged head, retry `transcribeSpeech` once and assign `text`; on
  null throw the original error; on a second failure throw with "(first-segment retry after bad-concat truncation
  ALSO failed)". Retry/terminal/idempotent machinery around it is untouched.
- read-path: a pitch whose stitched audio is a bad concat now COMPLETES (transcript from segment 1 persisted →
  analyzed → status `complete`) instead of terminally failing "corrupted"; a genuinely single-recording corruption
  still fails honestly, having spent exactly one STT call (no wasted retry).

## Files
- `src/lib/coach/v5/stitchSessionAudio.ts` — +`truncateAtSecondInitSegment` (pure).
- `src/lib/coach/doorlog/worker.ts` — import it; add the truncate-and-retry branch in the STT catch.
- tests:
  - `stitchSessionAudio.test.ts` (+2): truncate returns segment 1 for webm+webm and mp4+mp4 concats; returns null
    for a clean single recording (never truncates a good file).
  - `worker.test.ts` (+2): a two-init file → STT called twice (full rejected → salvaged head), the second buffer
    is shorter, the recovered text is persisted, the pitch is NOT failed; a single-recording corruption (no second
    init) → STT called ONCE, no wasted retry, no transcript.

## A26 boundary (class swept)
Grepped `transcribeSpeech`: the pitch `worker.ts` is the only LIVE consumer of stitched audio; `care/stt/route.ts`
transcribes a single customer voice blob (never stitched → no bad-concat shape); `elevenlabs.ts` is the impl. The
live/meeting `stitchSessionAudio` has no live STT consumer (meeting-coach not live-wired). Boundary = the pitch
worker; recovery placed there, helper kept pure/shared for any future consumer.

## Ripple (holistic — §6 item 5)
- One pure helper + a retry branch inside an existing catch. No schema/route/API/migration/external-config change.
- Only the FAILURE path gains work; a good recording passes STT on the first call and never enters the branch.
- The mp4-reseam (`63bf09d8`) PREVENTS new bad concats; this SALVAGES ones already stitched before it. Complementary.

## Honest limit
Recovers the NON-terminal cohort (bad concats still reprocessing) + is defense-in-depth. Does NOT touch terminal
`failed` pitches — they don't reprocess; recovering those (the founder's screenshotted pitch included) needs an
explicit re-queue with reprocessing cost, surfaced to the founder as a decision, not performed here.
