# BUILD — Team practice rollup + review fixes

### the team rollup (aggregate, no extra query)
- write-path: `practiceAnalytics.ts` `summarizeTeamPractice(perRep[])` → {activeReps, totalAttempts, avgLatest,
  improving, slipping} from the per-rep summaries already computed. `coach-assessment/route.ts` returns `teamPractice`
  built from `team.map(t => t.practice)`. NO new DB query.
- read-path: the Training manager view renders a "Team practice" stat card (`TeamPracticeCard`) above the per-rep list;
  honest empty when nobody has practiced.

### Finding-1 honesty fix (per-focus null, not a fake 0)
- write-path: `practiceAnalytics.ts` — `FocusTrend.latest/first: number | null`; the aggregation falls back to null
  when a focus has zero applied attempts (was `?? 0`). `training/page.tsx` renders "not applied yet" for a null latest.
- read-path: a skill drilled-but-never-executed reads honestly, never as a real 0 score.

### defense-in-depth tenant filter
- write-path: `coach-assessment/route.ts` — the manager practice read now pins `company_id = ctx.companyId` as well as
  `actor` (symmetric with the write; correct if reps ever span companies).
- read-path: the manager only ever sums their own company's practice events.

### A30 guard
- write-path: `practiceAnalytics.test.ts` (+4): per-focus latest null (Finding 1); team rollup honest zeros, aggregate
  math, and avg-null-when-no-applied — plus the manager summary already asserts no per-focus leak.
- read-path: a regression on the fixed honesty or the §A18 aggregate fails a test.

## Files
- `src/lib/coach/v5/practiceAnalytics.ts` — summarizeTeamPractice + Finding-1 null fallback.
- `src/lib/coach/v5/__tests__/practiceAnalytics.test.ts` — +4 tests.
- `src/app/api/coach/sales-session/coach-assessment/route.ts` — teamPractice + company_id-pinned practice read.
- `src/app/dashboard/sales-coach/training/page.tsx` — TeamPracticeCard + null-aware per-focus render.

## Ripple (§6 item 5)
No schema, no route, no migration. Rollup reuses per-rep summaries (no extra query). The default roleplay path and the
per-rep manager line are unchanged; the per-rep line already exposed only {attempts, latest, trend}.

## Honest limit
avgLatest is a simple mean of reps' latest scores; a weighted or per-skill team breakdown is additive. The rollup is
manager-only on the Training tab; a dashboard tile is a later surface.
