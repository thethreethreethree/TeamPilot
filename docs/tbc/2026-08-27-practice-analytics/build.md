# BUILD — Practice analytics

### the durable record (append-only event)
- write-path: `practiceAnalytics.ts` `recordPracticeScore` — appends a `coach.practice_scored` event
  ({focus, applied, score, coach_version}) via the admin client, subject `practice:<repId>`, best-effort. The roleplay
  route's scored branch calls it inside `after()` so a serverless freeze can't drop it; the default path is untouched.
- read-path: every trend is DERIVED by replaying a rep's `coach.practice_scored` events (§3.1) — no mutable counter.

### the aggregation (rep trend + manager growth)
- write-path: `practiceAnalytics.ts` `aggregateRepPractice` (sorts events chronologically; per-skill first→latest
  APPLIED score, ±6 threshold → up/flat/down; honest null when unpracticed) and `summarizePracticeForManager` (exposes
  ONLY {attempts, latest, trend} — no per-focus leak, §A18).
- read-path: the rep's own detail vs the manager's growth-direction-only summary.

### the reads (two existing routes)
- write-path: `my-training` returns the caller's own `practice` summary (bounded 200 events); `coach-assessment`'s
  team[] gains a per-rep `practice` summary (bounded 200 each, best-effort so a read error yields null not a false 0).
- read-path: the Training tab consumes both.

### the surface (Training tab)
- write-path: `training/page.tsx` — rep view gains a "Your practice" section (per-skill latest + a trend chip);
  manager per-rep card gains an UNRANKED activity + growth line. `TrendChip` = a DIRECTION (improving/holding/slipping).
- read-path: rep sees their trend; manager coaches from each rep's growth, never a leaderboard.

### A30 guard
- write-path: `practiceAnalytics.test.ts` (9 tests) — honest empty, applied:false-no-score, up/down/flat threshold,
  clamp + malformed-drop, byFocus recency order, and the manager summary carrying NO per-focus detail (§A18).
- read-path: a regression on any honesty seam fails a test.

## Files
- `src/lib/coach/v5/practiceAnalytics.ts` — write + aggregation.
- `src/lib/coach/v5/__tests__/practiceAnalytics.test.ts` — 9 honesty tests.
- `src/app/api/coach/sales-session/roleplay/route.ts` — append on scored attempt (after()).
- `src/app/api/coach/sales-session/my-training/route.ts` — rep's own practice summary.
- `src/app/api/coach/sales-session/coach-assessment/route.ts` — per-rep manager summary.
- `src/app/dashboard/sales-coach/training/page.tsx` — rep + manager practice UI.

## Ripple (§6 item 5)
No migration, no schema change, no new route. Append-only (§3.1). The default (no-focus) roleplay path is unchanged.
Practice-KPI reads are bounded (200/rep) + best-effort (a read error yields null, never a false 0 or a blanked page).

## Honest limit
Trend is first→latest applied score with a ±6 threshold — a simple, legible direction, not a regression line. The
manager view is per-rep growth; a team-wide practice rollup (total volume, avg improvement) is an additive follow-up.
