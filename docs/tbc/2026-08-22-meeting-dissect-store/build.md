# BUILD — Meeting Dissect generate-and-store (client-agnostic, server logic)

### Dissect event persistence
- write-path: `generateAndStoreMeetingDissect(companyId, actorId, sessionId, sessionTitle, segments)` calls
  `generateMeetingDissect`; on `hasSignal` it inserts a `meeting.dissect_generated` event (subject
  `meeting_session:<id>`, payload = decisions / actions / open_items / effectiveness / overall /
  coach_version); on a with-turns no-signal run it inserts a `meeting.dissect_attempted` backoff marker. Store
  is best-effort (a throw doesn't break the return).
- read-path: the stored events are read by the future post-meeting review UI + the per-team improvement-trend
  aggregate; the returned `MeetingDissect` is consumed by the tests now.

## Files
- `src/lib/coach/strategy/meeting/generateMeetingDissect.ts` — added `generateAndStoreMeetingDissect` (reuses
  `createAdminClient` + the `events` table).
- `src/lib/coach/strategy/meeting/__tests__/generateAndStoreMeetingDissect.test.ts` — 3 tests (generated event +
  payload/subject/kind; attempted backoff marker on no-signal-with-turns; nothing stored on empty segments).

## Reuse
Mirrors the sales `runAndStoreDissect` event shape; reuses `createAdminClient` + `events`. No sales/server change.

## Next
Re-transcribe trigger (diarized transcript from the durable audio) → call this → review UI + trend aggregate.
