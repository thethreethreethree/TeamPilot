# CLOSURE — Macro "Today's Metrics" two-page pager

## What shipped
The Macro Mode "Today's Metrics" middle tab is now ONE module with TWO swipeable pages (founder spec): the gamified
rep dashboard (the Arena) as the DEFAULT landing page, and the original door field-metrics read — switched by a top
segmented toggle AND a horizontal swipe. Built as `TodaysMetricsPager` reusing both dashboards unchanged; wired at
`/dashboard/sales-coach/doors/todays-metrics`. Checks (see check.md): typecheck exit 0, 6-of-6 pager render tests
(default page / toggle / swipe both ways / vertical-drag-ignored / tap-ignored / end-clamp), and a mobile-viewport
render of both pages read by eye (the founder specified the experience → §1.5.4 layer-2, so it was looked at).

## Checks (A38 — commands + coverage in check.md)
`npm run typecheck` exit 0; `TodaysMetricsPager.render.test.tsx` 6-of-6; a 390×844 harness render of page 0 + page 1.
Full `npm run check` runs at pre-commit + on merge.

## The un-named reliance
- Relies on the shell mounting the pager in a `flex-1 min-h-0` content slot so the pager's own `flex-1 min-h-0`
  panes get height (the standard shell pattern; TodaysMetrics already depends on it).
- Relies on RepArena tolerating a plain `overflow-y-auto` scroll parent (its `ra-wrap` doesn't scroll itself) and
  TodaysMetrics keeping its `flex-1 min-h-0 overflow-y-auto` root (pane 1 is a flex-col so that resolves).
- Both children fetch on mount; both panes are always mounted, so switching pages shows a ready (not re-fetching) view.

## Residual (A36)
```json
[
  {
    "id": "PAGER-R1",
    "item": "Jeff's product knowledge (elostateProductKnowledge.ts) has NO gamification content and states 'Coaching, never a leaderboard' — but the shipped Scoreboard/Arena IS a leaderboard (privacy-bounded). The whole gamification system needs a knowledge entry, and the framing is a product-voice decision.",
    "why_skipped": "Product positioning is the founder's call (surface, don't overtake); it applies to the whole gamification system, not just this pager. Surfaced as a decision.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-04T02:36:00+08:00",
    "outcome": "OPEN — founder picks the framing; then update elostateProductKnowledge.ts."
  },
  {
    "id": "PAGER-R2",
    "item": "The swipe is touchend-delta (no live finger-follow) — the page snaps on release rather than tracking the finger. Simpler + can't hijack vertical scroll, but less tactile than a drag-follow pager.",
    "why_skipped": "Deliberate: drag-follow needs non-passive touchmove + preventDefault gymnastics that risk breaking each pane's vertical scroll. The toggle + snap-swipe meets the spec.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-04T02:36:00+08:00",
    "outcome": "OPEN — add finger-follow later if the snap feels abrupt on device."
  },
  {
    "id": "PAGER-R3",
    "item": "The pager replaces /doors/todays-metrics for ALL viewports (desktop too), where the toggle works but swipe is moot. Desktop wasn't the founder's target; the toggle keeps it usable.",
    "why_skipped": "The toggle is viewport-agnostic, so desktop is functional; a desktop-specific side-by-side layout is a possible future refinement.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-04T02:36:00+08:00",
    "outcome": "OPEN — consider a two-column desktop variant if desktop use grows."
  }
]
```
