# BUILD — Rep Arena

### Client-safe band single source
- write-path: `src/lib/coach/gamification/bands.ts` (NEW) — POINTS_SCALE_MAX / STRONG_SESSION_THRESHOLD / BANDS /
  BAND_LABEL / bandFor / PointsBand, no `server-only`. `rubric.ts` + `points.ts` re-export from it.
- read-path: both server (rubric/points) and the client Arena import the SAME band definitions — no re-derivation.

### Pure derivation
- write-path: `src/lib/coach/gamification/arenaSummary.ts` (NEW) — `deriveArena(input)` → { band, bandLabel, best,
  deals, rank, strong, records, bars, milestones }. Leaderboard-missing fallbacks + milestone thresholds + top-3 /
  last-7 windows live here (gate-able).
- read-path: RepArena calls it once with the two fetched payloads and renders the result.

### The component + page + nav
- write-path: `src/components/sales-coach/RepArena.tsx` (NEW, client) — fetches the caller's own /my-points +
  /leaderboard, renders gauge / odometer / stats / records / badges / bars with scoped ELOSTATE CSS; page
  `src/app/dashboard/sales-coach/my-progress/page.tsx` (NEW); "My Progress" nav item (Gauge) in SalesCoachShell.
- read-path: a rep opens "My Progress" → their arena; each best-pitch links to its own after-pitch.

## Files
- `src/lib/coach/gamification/bands.ts` (NEW), `rubric.ts` (re-export), `points.ts` (re-export; removed dup bandFor)
- `src/lib/coach/gamification/arenaSummary.ts` (NEW) + `__tests__/arenaSummary.test.ts` (NEW, 6 tests)
- `src/components/sales-coach/RepArena.tsx` (NEW), `src/app/dashboard/sales-coach/my-progress/page.tsx` (NEW)
- `src/components/sales-coach/SalesCoachShell.tsx` (Gauge import + nav item)

## Ripple (§6 item 5)
- Splitting bands out of the server-only rubric.ts: all existing importers (bankPoints, notify, points, tests)
  unchanged via re-export; 27 gamification unit tests + the full suite (3994) pass.
- Accent uses --brand-text so it flips to a WCAG-AA ember on cream (the founder's prior light-mode fix); decorative
  glows/gradients soften under the light override → readable in both themes (verified by two rendered PNGs).
- New nav item is rep-facing (not managerOnly); nav test passes (16).
- Reuses /my-points + /leaderboard → no new route, no new migration; nothing else touched.
