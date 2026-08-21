# BUILD — Meeting Dissect route (the trigger)

### Post-meeting review endpoint
- write-path: `POST /api/coach/meeting-session/[id]/dissect` (owner-gated, meeting/huddle only) → if a
  `meeting.dissect_generated` event exists, return it (cache); else download the durable audio →
  `transcribeWithDiarization` (numSpeakers omitted → auto N-party) → map to segments →
  `generateAndStoreMeetingDissect` (stores the event).
- read-path: returns `{ dissect, cached }` for the review UI (next increment) to render. `?force=1` regenerates.

## Files
- `src/app/api/coach/meeting-session/[id]/dissect/route.ts` — the route (maxDuration 300 for batch STT).
- `.../dissect/__tests__/route.test.ts` — 7 tests (401/404/403-non-owner/400-sales/cache-hit-skips-transcribe/
  409-no-audio/happy-path with N-party auto + segment mapping).

## Reuse
`transcribeWithDiarization`, `assetUrlToStoragePath` + `downloadAssetBytes`, `getSession`, `resolveCoachingMode`,
`generateAndStoreMeetingDissect`. No sales/server change; new route only.

## Next
The post-meeting review UI (renders `{dissect}`) + the per-team improvement-trend aggregate over the events.
