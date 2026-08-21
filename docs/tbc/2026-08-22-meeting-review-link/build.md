# BUILD — Post-meeting review link

### Post-Stop continuity
- write-path: `endSession` records the just-ended session id (`endedSessionId`) before returning to setup.
- read-path: an "Meeting ended" view offers `Review this meeting` (→ `/dashboard/meeting-coach/<id>/review`) and
  `Start another` (clears the id → setup).

## Files
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — `endedSessionId` state + the ended view (next/link).

## Reuse
Links to the existing review page (which handles the audio-not-ready 409). No sales/server change.
