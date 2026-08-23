# BUILD — mobile Sales Coach honesty + contrast fixes (audit F4 / F4b / F5)

### a pitch load-failure is honest + retryable, not "missing" (F4)
- write-path: `PitchDetail.tsx` fetch moved into a `load` useCallback with a distinct `loadError` state — only a
  404 sets `notFound`; a non-ok (5xx) or a thrown `catch` (network drop) sets `loadError`; both reset on each load.
- read-path: a transient failure now shows "Couldn't load this pitch — this is an error, not a missing pitch" with
  a **Retry** button (mirrors PitchPerformance/TodaysMetrics); the permanent "isn't available" is reserved for a
  real 404. The back-nav still renders in every state.

### the mobile Pitches pill distinguishes "load failed" from "zero" (F4b)
- write-path: `page.tsx` `load()` sets a new `statsError` flag when the dashboard fetch is missing/`!ok`/throws;
  the mobile Pitches pill renders `statsError ? "—" : stats?.sessionsTotal ?? 0`.
- read-path: a dashboard-fetch failure shows "Pitches —" (a load-failure marker, matching the macro totals' "—"),
  never a false "Pitches 0" that reads as "no pitches". The desktop tiles are unchanged (own documented rationale).

### the only mobile exit is legible in both themes (F5)
- write-path: the "Back to ELOSTATE" link's `text-white/50 hover:text-white/80` → theme-aware
  `text-muted hover:text-secondary` (it sits on the theme-aware `bg-base`, not the fixed-dark nav shell).
- read-path: in light mode the link is now readable (was ~white-on-#FAFAFA = invisible); it is the only labeled
  mobile route back to ELOSTATE, so its legibility is load-bearing.

## Files
- `src/components/sales-coach/doorlog/PitchDetail.tsx` — loadError state + Retry (F4).
- `src/app/dashboard/sales-coach/page.tsx` — statsError → "—" on the mobile Pitches pill (F4b); Back link theme
  tokens (F5).
- tests: `PitchDetail.render.test.tsx` (+1: 500→retryable-not-missing), `macroCardVisibility.render.test.tsx`
  (+1: Pitches "—" on a failed dashboard fetch).

## Ripple (holistic)
- `statsError` lives on the shared `load`/`stats` but is READ only by the mobile pill — desktop tiles byte-
  unchanged. F5 swaps only color classes (no layout change). No route/schema/data change; additive.
- SCOPE: only the 3 clear low-risk bugs are fixed here. The design decisions (F1/F2 systemic mobile back-nav +
  active-tab gap; F3 "Pitch Performance" → two destinations) are surfaced to the founder via a picker, not built
  (§3.3 — multiple valid resolutions; the founder chooses, per the D1–D5 precedent).
