# BUILD — Macro Mode: Today's Metrics + Pitch Performance (2026-08-19)

Founder edit request (Macro Mode only): rename Report Card → Pitch Performance (recordings list, tabs removed);
add a new **Today's Metrics** surface (Next Door focus + Doors/Conversations/Sales + Score Chart + Opportunities
to grow, with the Day/Week/Month/All-Time tabs); Macro home → 3 cards. Founder decisions (AskUserQuestion this
session): Score Chart = the 5 dims per spec (objection/talk_listen/questions/tone/close, drop opener); Next Door
focus = top growth opportunity, auto (non-stateful).

Built in phases, each gate-green + guarded. This file is appended per phase.

### Phase 1 — pitch-analysis rubric (`src/lib/coach/doorlog/analyze.ts`)
read-path: the Score Chart grades the pitch-analysis `scores`; the founder's five dims replace the prior
opener/objection/tone/close rubric.
write-path: `RUBRIC_DIMENSIONS` → `["objection","talk_listen","questions","tone","close"]` (dropped opener, added
talk_listen + questions); prompt dimension descriptions + the `scores` JSON shape updated to match;
`ANALYSIS_PROMPT_VERSION` bumped v1→v2 (rubric changed → provenance). The `analysisSchema` `scores` field is a
flexible `z.record`, so pitches analyzed under v1 still validate — the Score Chart averages whichever dims a
period's pitches carry (honest: old pitches simply lack talk_listen/questions until re-analyzed).
guard: `rubricDimensions.test.ts` (pins the set + order + no-opener + v2). worker.test.ts still green.

### Phase 2 — Today's Metrics data + API
read-path: reuses `rep_kpi_daily` (KPIs), `pitch_analyses.scores` (Score Chart), `rep_pattern_summaries` (focus +
opportunities) — the SAME windows as the rollup so metrics + patterns describe the same doors.
write-path: pure `period.ts` (`periodStartLocal` — day/week/month/all_time windows matching the rollup;
`averageScores` — per-dim mean skipping absent dims so mixed v1/v2 rubrics aren't diluted; `isMetricsPeriod`), 5
tests. `getTodaysMetrics(repId, period)` in `data/doorlog.ts` (RLS-scoped; paged KPI + score reads via
fetchAllPaged — no 1000-row truncation; focus = the #1 growth opportunity, auto). Route
`GET /api/coach/sales-session/todays-metrics?period=`.
guard: `period.test.ts` (windows + averaging + mixed-rubric). getTodaysMetrics is DB-wiring over tested pure
helpers + tested fetchAllPaged (same posture as getAllTimeKpi — no unit DB test).

### Phase 3 — Today's Metrics UI
write-path: `TodaysMetrics.tsx` (fixed-shell idiom flex-1 min-h-0 overflow-y-auto; Day/Week/Month/All-Time tabs
moved here off the Report Card; Next-Door focus card framed "focus for your next 10 doors"; KPI trio Doors/
Conversations/Sales; Score Chart rendering ONLY the dims present in the data — no phantom 0 for an unscored dim;
Opportunities to grow; honest error+retry, never a zeroed page). Route
`/dashboard/sales-coach/doors/todays-metrics`.
guard: `TodaysMetrics.render.test.tsx` (loaded content + present-dims-only + honest-error).

### Phase 4 — Report Card → Pitch Performance (rename + restructure)
write-path: report-card API joins `pitch_analyses(summary)` per pitch; `ReportCard.tsx` rewritten as Pitch
Performance — heading renamed, period tabs + pattern hero REMOVED (moved to Today's Metrics), the recordings
list now shows each pitch's after-pitch summary inline + outcome badge, drilling into PitchDetail. Honest error
("not an empty history"). Route path /doors/report-card KEPT (PitchDetail's [pitchId] + back-link depend on it);
labels updated — MacroModeToggle "Report Card"→"Pitch Performance", PitchDetail back-nav likewise. (Internal
component/route name stays ReportCard/report-card to avoid a path cascade; display is Pitch Performance.)
guard: ReportCard.render.test (honest error + loaded recordings-with-summary); PitchDetail test back-nav label.

### Phase 5 — Macro home: the 3 cards (founder wireframe)
write-path: `page.tsx` mobile grid is now macroOn-conditional — Macro ON shows the THREE door-to-door surfaces
(Door Log + Today's Metrics on the top row, Pitch Performance full-width below); Macro OFF shows the normal 2×2
launchpad unchanged (the earlier hide-2-cards behavior is superseded by this cleaner split). MacroModeToggle's
redundant Door Log/Pitch Performance link grid removed — it's the on/off switch now; the 3 cards are the nav.
guard: `macroCardVisibility.render.test.tsx` updated — ON shows the 3 cards + bubbles + Start Knocking, no
launchpad cards; OFF unchanged. Full gate green (3035 tests, 0 invariant violations).

### Follow-ups (noted, not blocking)
- DESKTOP: the wireframe is mobile; the desktop Macro experience (Today's-Metrics sidebar entry / desktop 3-card
  view) is not yet built — the desktop sidebar still only hides /sessions + /strategy when macroOn.
- Internal naming: the component/route stay ReportCard//report-card (display "Pitch Performance") to avoid a
  path cascade through PitchDetail — a pure rename is a safe later refactor.

### Post-build audit fixes (2 adversarial agents on the new code)
Agents confirmed the core components + data path clean (tenant/IDOR, truncation, math all verified). Fixed:
- Desktop-nav regression (removing the toggle link grid orphaned desktop Macro reps) → `showLinks` prop restores
  the 3-surface nav on desktop; mobile keeps its cards.
- Wrong-mode flash (macroOn null folded into OFF) → skeleton holds the mobile grid/bubbles/CTA while null.
- report-card route swallowed the pitch read error (the new pitch_analyses join enlarged it) → captures + 500s.
- todays-metrics route wrapped in try/catch (log + generic 500).
Accepted-minor: silent-zero bubbles + getTodaysMetrics summary-read swallow (secondary; Today's Metrics honest);
mode-GET failure defaults to OFF.

### P6 — Macro Mode bottom nav (founder screenshot: nav didn't match the wireframe)
write-path: SalesCoachShell mobile bottom tab bar is now macroOn-conditional — Macro ON shows MACRO_MOBILE_TABS
(Home · Role Play · Team Chat · AI Agent per the wireframe; AI Agent → the Live AI Coach/Sessions, founder-
confirmed); Macro OFF shows the normal 5 (Home/Analytics/Sessions/Team Chat/Account). Reuses the shell's existing
macroOn state (same one that drives the sidebar focus).
guard: salesCoachShellNav.test — MACRO_MOBILE_TABS is exactly the 4 wireframe tabs (right hrefs; no Analytics/
Account) + the render swaps on macroOn. Full gate green (3037 tests).

### Post-build audit fix (follow-up): C3 honest KPI bubbles
The dashboard's 3 Macro bubbles showed "0" on a totals-fetch failure (silent-zero, §3.4). Added a
macroTotalsError flag → the bubbles show "—" on error, never a false "0". (C4 mode-GET-defaults-OFF and D2
getTodaysMetrics summary-read swallow remain accepted-minor: secondary surfaces, primary feeds honest.)

### Guard follow-up: report-card route test (locks the D1 honesty fix)
Added `report-card/__tests__/route.test.ts` — a pitch-read ERROR returns 500 (not a false 200-with-empty-
pitches), a success returns the pitches + their after-pitch summary, unauth → 401. Locks the D1 fix at the route
level (the client render test already guards the on-500-show-error side).

### R3 resolved — component rename (code-smell cleanup)
Renamed the component ReportCard → PitchPerformance (file + component + test, git mv preserving history), so it
no longer reads as "ReportCard renders Pitch Performance". Route PATH kept (/doors/report-card) so PitchDetail's
[pitchId] + back-link + the API path don't cascade. No lingering imports; typecheck + tests green.

### Holistic flow audit (composition layer, AMD-006 L3) + guard
Traced the Macro rep's end-to-end journey (toggle → 3-card home → Door Log → record → save → Today's Metrics /
Pitch Performance) for workflow-continuity breaks the file-level agents wouldn't catch. Result: SOUND — Door Log
save auto-advances to idle ("next door") with zero waiting, a failed send surfaces a banner (never dressed as
saved), the optimistic KPI self-corrects via loadKpi(); the async surfaces show honest lag/empty states. The one
GAP was a guard gap, not a behavior gap: the AMD-006-critical auto-advance (save → idle) was unasserted in
DoorLogFlow.render.test — now clicked-through and locked (idle field actions return, naming form gone).

### Perf: parallelize getTodaysMetrics reads
The KPI, score, and rollup-summary reads (all keyed on the window from `latest`) were awaited sequentially, so
the rep waited on their sum. Wrapped in Promise.all — the rep now waits on the slowest, not the total. Behaviour-
preserving (same reads, same paging); matches the codebase's "parallelize independent reads" perf pattern. Gate
green (3040 tests).

### Cleanup: drop the dead summary read from the report-card route
After P4, Pitch Performance shows only the recordings list — the macro pattern summary moved to Today's Metrics.
The report-card route was still reading rep_pattern_summaries and returning a top-level `summary` field that no
consumer uses (PitchPerformance uses only `pitches` + each pitch's own summary). Removed the dead read + field —
one fewer DB read per Pitch Performance view. Route test + PitchPerformance render test green.

### Cleanup: drop the now-vestigial period handling from report-card
Removing the pattern summary left the period param/parsing dead (the pitch list was never period-filtered; the
tabs moved to Today's Metrics). Removed PERIODS + the param + the returned `period` field. Route test green.
