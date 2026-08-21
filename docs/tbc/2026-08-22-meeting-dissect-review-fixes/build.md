# BUILD — Meeting Dissect review-fix pass

### 1. Cost-loop fix (no-signal re-charge)
- write-path: `generateAndStoreMeetingDissect` emits `meeting.dissect_attempted` on EVERY no-signal run.
- read-path: `POST .../dissect` reads the newest of BOTH kinds; an `attempted` marker returns `{dissect:null,
  cached:true, empty:true}` without re-transcribing.

### 2. Trend dedup
- write-path: n/a. `aggregateMeetingDissects` dedups rows by subject (newest per subject); trend route selects
  `subject`.
- read-path: the trend's `meetings` count + ratios reflect distinct meetings, not events.

### 3. History kind-filter in the DB
- write-path: n/a. `listAgentMeetingSessions(agentId, limit)` — `.in(session_kind, [meeting,huddle])` in the
  query, A34-safe (missing column → []).
- read-path: `GET /api/coach/meeting-session` maps its result; meetings can't be hidden behind sales rows.

## Two smaller fixes (not data features — no reachability paths)
- **4. MeetingReview unmount guard.** `mountedRef` + guards after each awaited fetch step.
- **5. Owner honesty.** `parseMeetingDissect` NO_OWNER regex adds `null` (+ someone/the team/everyone).

## Tests
- Updated: generateAndStore (0-segments now stores attempted), dissect route (chainable admin mock + attempted-
  marker cache test), meeting-session GET (listAgentMeetingSessions), aggregate (dedup test). Full gate exit 0
  (3602) — see check.md.

## Reuse
`isMissingColumnError` (A34 guard), the events store, the transcription route. No sales/server behavior change
(the new helper is additive; listAgentSessions is untouched).
