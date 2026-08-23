# BUILD — desktop error-as-no-data + Door Log back (audit class completions)

### the desktop home tiles are honest on a failed fetch (completes the F4b class)
- write-path: `page.tsx` — each desktop `DeckStat` value (Sessions/week + its sub, Growth reviews, Live cues,
  Growth ops) now renders `statsError ? "—" : stats?.X ?? 0`, reusing the F4b flag (no new state/fetch).
- read-path: a dashboard-fetch failure shows "—" across the desktop tiles, not a false "0 activity"; a genuine
  zero still shows 0. Matches the mobile Pitches pill + macro totals — the class is now swept on this page.

### Door Log has an in-page back (completes the "systemic back — covers all" pick)
- write-path: `DoorLog.tsx` — an IDLE-ONLY "← Sales Coach" link (to `/dashboard/sales-coach`) at the top of the
  container; hidden in recording/outcome/naming so it can't intrude on the field flow.
- read-path: a rep on Door Log (which renders no TopBar) now has an in-page way back to the SC home, matching
  every other SC mobile page; the macro Home tab remains as the alternative return path.

## Files
- `src/app/dashboard/sales-coach/page.tsx` — desktop tiles consume `statsError` (F4b class completion).
- `src/components/sales-coach/doorlog/DoorLog.tsx` — idle-only back link + Link/ArrowLeft imports.
- tests: `homeDesktopStatsError.render.test.tsx` (NEW — desktop tiles show "—" on a failed fetch, with LearningHint
  rendering children so the tiles mount), `DoorLogFlow.render.test.tsx` (+2 assertions: back link present in idle
  with the right href; absent mid-record).

## Ripple (holistic)
- `statsError` is the pre-existing F4b flag — the desktop tiles are a NEW consumer, no new state. `DeckStat.value`
  is `ReactNode`, so "—" is type-clean. Desktop tiles were previously swallowed by the LearningHint→null mock in
  the macro test, so the new test lets LearningHint render children to exercise them.
- Door Log's back link is idle-only + `self-start` — no disruption to the bottom-anchored field states. No route/
  schema/data change; a genuine zero still shows 0. This is the BOUNDARY: remaining backlog (D3 latent race, D5
  scoped-out, device validation) is gold-plating/founder-side — not built.
