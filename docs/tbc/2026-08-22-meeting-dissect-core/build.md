# BUILD — Meeting post-meeting Dissect measurement core

### Post-meeting Dissect measurement
The §3.5 consequence measurement for a meeting (decisions / owned-actions / open-items / effectiveness).
- write-path: `generateMeetingDissect(companyId, sessionTitle, segments)` builds the meeting-dissect prompt,
  calls the reused `dissectCoachV5` LLM binding, and parses the response into a `MeetingDissect`. INV22: an
  empty/unparseable LLM response is logged loudly + returns the honest empty state, never a fabricated review.
  (STORAGE — persisting the MeetingDissect as an event — is the NEXT increment, not this build.)
- read-path: the `MeetingDissect` struct (`decisions[]`, `actions[]` with `owner|null`, `openItems[]`,
  `effectiveness`, `overall`) is the structured measurement consumed by the parse tests now, and by the future
  post-meeting review UI + the "did meetings improve?" aggregate. (The UI is the NEXT increment.)

## Files
- `src/lib/coach/strategy/meeting/parseMeetingDissect.ts` — the `MeetingDissect` type + a pure, total,
  silent-safe parse (drops blanks, nulls an unnamed owner, EMPTY on malformed).
- `src/lib/coach/strategy/meeting/meetingDissectPrompt.ts` — the system + user prompt (measures consequence, is
  never shown the cues, forbids fabrication, JSON-only, anti-injection fence).
- `src/lib/coach/strategy/meeting/generateMeetingDissect.ts` — generation, reusing `dissectCoachV5`, INV22-safe.
- `src/lib/coach/strategy/meeting/__tests__/parseMeetingDissect.test.ts` — 6 tests (full parse, owner-null
  failure signal, blank-drop, fenced JSON, malformed→EMPTY, hasSignal logic).

## Reuse
Reuses `dissectCoachV5` (the sales deep-eval LLM binding) + `renderTurns`. No sales/server change; new
strategy-dir files only.

## Next increment (flagged, not built here)
Re-transcribe the durable audio with diarization → run `generateMeetingDissect` → store as an event → render a
post-meeting review UI + a per-team improvement-trend aggregate.
