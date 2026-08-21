# BUILD — Meeting trend tile

### Team meeting-trend surface
- write-path: n/a (read-only). `MeetingTrendTile` fetches `GET /api/coach/meeting-session/trend` on mount.
- read-path: renders the direction (improving/holding/slipping/insufficient) + actions-owned %, stayed-focused %,
  decisions/meeting; "insufficient" shown plainly; renders null on any load failure. Placed at the top of the
  meeting-coach SETUP view.

## Files
- `src/components/sales-coach/MeetingTrendTile.tsx` — the tile (theme tokens, tabular-nums, silent-on-failure).
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — renders `<MeetingTrendTile />` above the start form.

## Reuse
Consumes the trend route; theme tokens. No sales/server change.
