# CHECK — KPI truncation fix

## Verification run (A38 — canonical command + exit code)
Canonical command: `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc
&& test).

## Findings
### F1 — KPI usage-growth reads truncated at 1000 rows, corrupting the Reliance Reduction headline metric
file+line: `kpi/me/route.ts` (after_pitch_summaries ~96; cues/cue_outcomes/transcript_segments ~135-137) + `kpi/team/route.ts` (cues ~113, transcript_segments ~129, after_pitch_summaries ~140).
class: JS-side aggregation over an unbounded `.select()` silently capped at PostgREST max_rows=1000 (the `unbounded_select_silent_truncation_1000cap` class). Distinct from finance, which aggregates in SQL (RPC) and is immune.
severity: high — the sessions were paged but the dependent reads weren't; transcript_segments crosses 1000 at ~25-30 coached sessions, so the §3.5 Reliance Reduction HEADLINE metric + cueAcceptanceRate were computed over the wrong session set for most active reps, in BOTH the rep and manager views (breaking the cross-view consistency the honesty thesis rests on). Likely live-wrong pre-fix.
sweep-command: `grep -nE "\.from\(\"(coaching_cues|coaching_cue_outcomes|coaching_transcript_segments|after_pitch_summaries)\"" src/app/api/coach/kpi/me/route.ts src/app/api/coach/kpi/team/route.ts` — enumerated all seven; all seven now inside a `fetchAllPaged(...).range(...)` window (compute-cron + trajectory were separately checked clean in the audit).

## Targeted tests
```
$ npx vitest run src/app/api/coach/kpi
 Test Files  5 passed (5)
      Tests  27 passed (27)
```

## Full gate
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (13) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 396 passed | 1 skipped (397); Tests 2731 passed | 15 skipped (2746)
CHECK_EXIT=0
```
