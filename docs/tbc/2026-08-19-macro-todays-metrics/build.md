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
