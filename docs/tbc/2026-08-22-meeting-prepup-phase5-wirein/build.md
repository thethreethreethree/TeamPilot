# BUILD — Prep-up Phase 5: wire-in

### create route links the prep
- write-path: `POST /api/coach/meeting-session` accepts optional `prepId`; after `createSession`, calls
  `markMeetingPrepStarted({ prepId, sessionId })` (best-effort) so the prep binds to the session.
- read-path: the Ph3 cue route reads the agenda by `meeting_preps.session_id` — no change needed there.

### panel carries the prepId + connects the flow
- write-path: the meeting-coach page reads `?prepId` SERVER-SIDE and passes `initialPrepId` to
  `MeetingCoachingPanel`, which includes it in the create body.
- read-path: setup shows "✓ Your prep is loaded" when a prep is present, else a "Prep this meeting first →" link
  to `/dashboard/meeting-coach/prep`. Prep-up's "Start Meeting" → `/dashboard/meeting-coach?prepId=…` (Ph2).

## Files
- `src/app/api/coach/meeting-session/route.ts` — `prepId` in the schema + `markMeetingPrepStarted` link.
- `src/app/dashboard/meeting-coach/page.tsx` — read `?prepId` (server) → `initialPrepId`.
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — accept `initialPrepId`, send it on create, indicator +
  Prep-first link.
- `src/app/api/coach/meeting-session/__tests__/route.test.ts` — +2 tests (prepId links; no prepId doesn't).

## Reuse
Reuses the Ph3 `session_id` agenda lookup, the existing create route/panel, and `markMeetingPrepStarted` (Ph1).
Additive: a prep-less meeting is byte-unchanged. Global nav + module-gating deferred to go-live (§1.5.3).
