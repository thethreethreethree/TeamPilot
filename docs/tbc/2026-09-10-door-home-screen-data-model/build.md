# BUILD — door home screen, Phase 04: data model + read layer

### The migration (NOT applied — founder reviews first)
- write-path: `supabase/migrations/0247_door_home_screen_day_target.sql` — `rep_daily_sales_goal` (per-rep
  standing goal, manager-write RLS via the 0215 same-company-manager predicate) + `rep_day_target` (frozen
  targets, PK rep_id+local_date, rep-insert-own RLS). No new activity table; doors/presentations/sold stay in
  door_knocks/pitches.
- read-path: `db:dry` shows it as the single pending migration; it applies with `npm run db:apply` after review.

### The read/compute layer
- write-path: `src/lib/coach/doorlog/dayTargetData.ts` — `getOrFreezeDayTarget()` reads the frozen row (never
  recompute intra-day), else reads the manager goal + computes 30-day close/contact ratios from
  door_knocks/pitches, calls the pure engine, and freezes (insert-only, no-op on conflict).
- read-path: the door screen (Phase 07) will call this to render the three dials + "sales to goal"; a manager
  view can read a rep's frozen row. Caller-scoped db → RLS is the access control.

### Honest degradation
- write-path: no manager goal → `EMPTY_NO_GOAL` returned and NOT frozen (the manager may set it later today).
- read-path: the screen shows the empty/starter state, never a fabricated target; qualified = ≥10 presentations
  AND ≥1 sale in 30 days, else starter ratios via the engine.

### The gate (A30)
- write-path: `src/lib/coach/doorlog/__tests__/dayTargetData.test.ts` — 5 tests pin the three paths (frozen →
  no recompute/insert; no-goal → empty, no freeze; qualified → compute + freeze on the caller's own row) plus a
  thin-history starter case.
- read-path: a regression that recomputes a frozen day, or freezes a no-goal rep, fails these.

## Files
- `supabase/migrations/0247_door_home_screen_day_target.sql`
- `src/lib/coach/doorlog/dayTargetData.ts`
- `src/lib/coach/doorlog/__tests__/dayTargetData.test.ts`

## Ripple (§1.5)
- Additive: no existing table or policy changed; the new tables reuse the exact 0215 RLS predicate.
- The migration is unapplied, so nothing in the live app reaches these tables yet (A34 — the UI phases wire it
  only after apply). The engine on main is still unreached.
