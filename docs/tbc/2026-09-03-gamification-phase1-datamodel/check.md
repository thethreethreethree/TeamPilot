# CHECK — Gamification Phase 1 (data model)

## Migration: `npm run db:apply`
```
[db-apply] 1 pending migration(s): 0242_gamification_points_ledger.sql
...
✅ ALL 30 invariants hold.
[db-apply] ✓ verify:live passed — structural invariants intact after the migration.
```
The two new company_id tables passed the tenant-isolation + RLS + no-permissive-read invariants.

## Typecheck: `npm run typecheck` → clean (exit 0).

## Behavioral proof (rolled-back tx): `node scripts/verify-gamification-ledger.mjs`
```
  ✓ insert a session_score row — id ba1ada4d
  ✓ UPDATE is blocked (append-only) — agent_point_ledger is append-only — bank a new offsetting row, never update
  ✓ DELETE is blocked (append-only) — agent_point_ledger is append-only — bank a new offsetting row, never delete
  ✓ double-bank blocked (unique session_score per session) — duplicate key value violates unique constraint ...
  ✓ a correction row for the same session is allowed
✅ 5 passed, 0 failed (transaction rolled back — no rows persisted)
```

## Config test: `npx vitest run src/lib/coach/gamification/__tests__/rubric.test.ts` → 5 passed
(bands cover 0..100 contiguously, strong threshold at the band floor, every point classifiable, dims reuse ScoreKeys.)

## Definition-of-done (plan Phase 1)
- ✅ Migrations run clean forward (db:apply). ✅ Types compile. ✅ UPDATE fails (demonstrated). ✅ Two `scored`
  rows / double-bank fails (demonstrated via the session_score unique index). ✅ RLS present + tenant-isolated.
- N/A: "dimension score 0/11 fails" — there is NO session_scores table (REUSE decision); dimension scores live in
  the existing after_pitch_summaries, unchanged.

## Findings
- No findings. Append-only + no-double-bank DB-enforced and behaviorally proven; RLS company-scoped + privacy-preserving.

## Not claimed
- No API/UI/mapping yet (Phase 2+). The leaderboard aggregate view is noted for Phase 5, not built.
- Deploy of the migration file rides the next merge; the migration itself is already applied to the live DB.
