# BUILD — Meeting history list

### Recent meetings -> review
- write-path: n/a (read). `GET /api/coach/meeting-session` = `listAgentSessions(user)` filtered to
  meeting/huddle, returning {id,title,kind,startedAt,endedAt}.
- read-path: `MeetingHistoryList` renders the rows under the trend tile on the setup view; each links to
  `/dashboard/meeting-coach/<id>/review`. Null when empty / on failure.

## Files
- `src/app/api/coach/meeting-session/route.ts` — added GET (+ 2 tests: 401, kind-filter).
- `src/components/sales-coach/MeetingHistoryList.tsx` — the list.
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — renders it in the setup view.

## Reuse
`listAgentSessions` (filtered by sessionKind); theme tokens. No sales/server change.
