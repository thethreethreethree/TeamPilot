# BUILD — Meeting Coach client (in-person MVP)

Two data features with both reachability paths (A31), plus the client pieces that drive them.

### Meeting session creation
- write-path: `POST /api/coach/meeting-session` (owner = current user; company-scoped) → `createSession` with
  `sessionKind` → a `coaching_sessions` row carrying `session_kind` (only written for meeting/huddle — A34).
- read-path: `getSession` → `resolveCoachingMode` → the cue route; the panel receives the created session id and
  starts the live loop against it.

### Live meeting capture + cue
- write-path: `useMeetingCoaching` streams mic → Scribe STT → UNLABELED committed turns; on each committed turn
  (auto-coach) or a "coach me now" tap it POSTs `/api/coach/meeting-session/[id]/cue`, which appends a delivered
  cue to `coaching_cues`.
- read-path: the returned cue is SPOKEN to the earpiece via the shared `/tts` route AND shown in
  `MeetingCoachingPanel`; the rolling turns render in the panel's transcript.

## Client pieces
- `src/lib/coach/v5/useMeetingCoaching.ts` — the self-contained transport (mic + Scribe WS + audio graph + basic
  bounded reconnect), a duplicated pure PCM encoder (no edit to the sales hook), unlabeled turns, the meeting cue
  loop, `speakCue` via `/tts`, clean teardown on stop/unmount.
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — setup (kind / where / title / earpiece gate → create)
  then the live view (mic meter, the current cue, coach-me-now, auto-coach toggle, wrapping-up, stop, transcript).
  The start effect fires AFTER sessionId is set so the hook carries the real id.
- `src/app/dashboard/meeting-coach/page.tsx` — hosts the panel (auth/company from the dashboard layout).

## Server pieces
- `src/lib/data/salesCoach.ts` — `createSession` gains an optional `sessionKind`; the insert conditionally adds
  `session_kind` ONLY for a non-default kind (A34 write-safety).

## Reused vs new
- REUSED: the `/realtime-token` + `/tts` routes, the Scribe v2 realtime protocol, `coaching_sessions`,
  `coaching_cues`, `createSession`, the meeting cue endpoint + strategy core.
- NEW: the meeting create route, the `sessionKind` create arg, `useMeetingCoaching`, `MeetingCoachingPanel`, the
  page. The sales hook is UNTOUCHED.
