# BUILD — Meeting Dissect improvement-trend aggregate

### Team meeting-improvement trend
- write-path: n/a (read-only aggregate over stored events). `aggregateMeetingDissects(rows)` (pure) computes
  overall + recent-vs-earlier `MeetingMetrics` (decisions/meeting, owned-action ratio, focused ratio,
  open-items/meeting) and a `direction` (improving/flat/declining/insufficient) from the two quality ratios.
- read-path: `GET /api/coach/meeting-session/trend` (company-pinned, INV15) fetches the company's
  `meeting.dissect_generated` events and returns the trend for a team dashboard/view (the UI is a follow-up).

## Files
- `src/lib/coach/strategy/meeting/aggregateMeetingDissects.ts` — the pure aggregate (MIN_FOR_TREND, TOLERANCE,
  defensive shape handling).
- `.../__tests__/aggregateMeetingDissects.test.ts` — 6 tests (insufficient/improving/declining/flat/overall/
  defensive-malformed).
- `src/app/api/coach/meeting-session/trend/route.ts` + test (4: 401/403/company-pinned-aggregate/insufficient).

## Reuse
Reads the `events` table (the dissect store); no sales/server change.
