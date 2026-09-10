# BUILD - carry the recording's own timing into spoken_at

### Stop dropping the offset at the upload boundary
- write-path: `src/app/api/coach/sales-session/[id]/upload-recording/route.ts` - `buildSpeakerResponse` now
  accepts `{ speakerId, text, start? }` and returns `startSeconds` alongside `seq`. The field is OMITTED when
  the diarizer gave no number, never zeroed: a 0 claims the turn opened the call.
- read-path: the client that just uploaded gets the offsets back with the speakers, and echoes both when the
  rep taps which voice is theirs.

### Write it as spoken_at when the transcript is labelled
- write-path: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts` - the body schema gains an
  OPTIONAL `startSeconds` per segment; each labelled segment carries
  `spokenAt: spokenAtFor(session.startedAt, seg.startSeconds)`.
- write-path: `src/lib/coach/v5/segmentTiming.ts` - one pure function joining an audio offset to a wall clock,
  refusing a negative or absurd offset and returning null for an unknown one.
- read-path: `agentWpm` finally sees timed agent turns for an uploaded call, so `speedScore` can score.

### The recovery re-transcribe path, which was the last place it could not land
- write-path: `supabase/migrations/0249_replace_transcript_spoken_at.sql` - `replace_session_transcript` reads
  `spokenAt` from the jsonb instead of selecting a literal null. `create or replace`, idempotent, and a payload
  without the key still yields null, exactly as 0212 always did.
- write-path: `src/lib/data/salesCoach.ts` - `replaceSessionTranscript` forwards `spokenAt`.
- read-path: a rep who re-transcribes a broken one-sided call gets the pace skill too, not just a first label.

### The gate (A30)
- write-path: `src/lib/coach/v5/__tests__/segmentTiming.test.ts` (5) pins the join, the preserved GAPS, the
  null-not-base rule and the corrupt-offset refusal; `label-transcript/__tests__/route.test.ts` (+2) pins what
  `appendTranscriptSegment` actually receives, both with offsets and without.
- read-path: a regression that drops the offset, or that stamps an unknown one with the start of the call,
  fails a named test rather than going quiet.
- gate-or-promise: `npx vitest run src/lib/coach/v5/__tests__/segmentTiming.test.ts "src/app/api/coach/sales-session/[id]/label-transcript"` - proven by mutation: making `spokenAtFor` fall back to the base for an unknown offset failed exactly the two tests written for it (pasted in check.md).

## Files
- `src/lib/coach/v5/segmentTiming.ts` (new)
- `src/lib/coach/v5/__tests__/segmentTiming.test.ts` (new)
- `src/app/api/coach/sales-session/[id]/upload-recording/route.ts`
- `src/app/api/coach/sales-session/[id]/label-transcript/route.ts`
- `src/app/api/coach/sales-session/[id]/label-transcript/__tests__/route.test.ts`
- `src/lib/data/salesCoach.ts`
- `supabase/migrations/0249_replace_transcript_spoken_at.sql`

## Ripple (1.5)
- Every change is additive and optional. A client that does not send `startSeconds` behaves exactly as today.
- Nothing about the LIVE coaching path changes - it already stamps `spokenAt` at capture.
- 0249 replaces a function, adds no column and touches no policy. Sending `spokenAt` to the pre-0249 function
  is harmless (it ignores unknown keys), so deploy order cannot cost a transcript (A34).
- Downstream consumers of `spoken_at` gain data they already handle: `salesMoments` and `salesPivot` use the
  earliest known stamp as a timeline origin and explicitly tolerate its absence, so uploaded calls start
  producing grounded cue timestamps as a side effect rather than changing behaviour.
