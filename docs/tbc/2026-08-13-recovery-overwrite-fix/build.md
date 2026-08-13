# BUILD — recovery overwrite of a broken 0-agent-turns transcript

### deleteSessionTranscriptSegments (narrow append-only exception)
read-path: `src/lib/data/salesCoach.ts` — new `deleteSessionTranscriptSegments(sessionId)`.
write-path: service-role `delete().eq("session_id", sessionId)` on `coaching_transcript_segments`; logs + returns
false on error. Documented as the gated exception to append-only — the CALLER must gate it (0 agent turns +
owner); this is the mechanism only.

### label-transcript: guard on agent turns, not existence
read-path: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts` reads `getSessionTranscript(id)`.
write-path: if `existing.some(s => s.speaker === "agent")` → 409 (canonical, never clobbered). Else if
`existing.length > 0` (segments but 0 agent turns → broken read) → `deleteSessionTranscriptSegments(id)` to clear
the broken segments (so the re-diarized ones don't 23505-collide), then the existing append loop saves the
corrected transcript + schedules generation. Owner gate + rate limit unchanged. Stale comments corrected.

## Test coverage
`label-transcript/__tests__/route.test.ts`: the existing 409 test uses an `agent` segment (still 409s, asserts
NO delete). New test: existing = customer + `unknown` (0 agent) → asserts `deleteSessionTranscriptSegments`
called with the id, the 3 re-diarized segments appended, 200. 10 tests pass.
