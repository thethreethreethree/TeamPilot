# BUILD — Macro "Today's Metrics" two-page pager

### The pager
- write-path: `src/components/sales-coach/TodaysMetricsPager.tsx` (NEW) — a `flex-1 min-h-0 flex flex-col` module:
  a top segmented toggle (role=tablist "Progress" | "Metrics") + a horizontal pager viewport. Track `width:200%`,
  two 50% panes, `transform: translateX(-page*50%)`, `transition-transform` (motion-reduce:none). Pane 0 =
  `overflow-y-auto` wrapping `<RepArena/>` (gives it a scroll parent); pane 1 = `flex flex-col` holding
  `<TodaysMetrics/>` (which brings its own `flex-1 min-h-0 overflow-y-auto`). Default page 0 = Progress (gamified).
- read-path: the rep taps the "Today's Metrics" middle tab → lands on the gamified progress page → taps the toggle
  OR swipes to the original field metrics. Both pages are always mounted, so a swipe reveals a ready page.

### Swipe
- write-path: `onTouchStart`/`onTouchEnd` on the viewport record a start/end delta (mirrors CareRadialHome). NO
  `preventDefault` → each pane's native vertical scroll is untouched. A page flips only on a horizontal-dominant
  fling: `|dx| ≥ 50` AND `|dx| ≥ 1.5·|dy|`. Clamped to [0, 1] (no third page).
- read-path: swipe left → Metrics, right → Progress; a vertical drag or a tap never changes the page.

### Wiring
- write-path: `src/app/dashboard/sales-coach/doors/todays-metrics/page.tsx` now mounts `<TodaysMetricsPager/>`
  instead of the bare `<TodaysMetrics/>` (keeps `export const dynamic = "force-dynamic"`).
- read-path: the Macro "Today's Metrics" middle tab (`MACRO_MOBILE_TABS`) already points at this route, so tapping
  it now lands on the pager (Progress page) with no nav change — the tab's destination is unchanged, its content is
  the two-page module.

## Files
- `src/components/sales-coach/TodaysMetricsPager.tsx` (NEW) + `__tests__/TodaysMetricsPager.render.test.tsx` (NEW, 6 tests)
- `src/app/dashboard/sales-coach/doors/todays-metrics/page.tsx` (mount the pager)

## Ripple (§6 item 5)
- Reuses RepArena + TodaysMetrics UNCHANGED — no change to either dashboard's data/behavior; two separate data
  systems (session gamification vs door doorlog) sit side by side, never conflated.
- The toggle is the primary accessible control; swipe is the enhancement (AMD-006 layer-4) — no swipe-only trap.
- The `/my-progress` route + the Scoreboard's MyProgress strip are untouched (scope = the Macro tab the founder
  pointed at). Jeff's product-knowledge update for the gamification system is deferred pending a founder framing
  decision (the existing knowledge says "never a leaderboard"; the shipped Scoreboard is one, privacy-bounded).
