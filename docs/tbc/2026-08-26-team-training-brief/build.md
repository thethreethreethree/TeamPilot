# BUILD — Team Training Brief engine (slice 1 of the training system)

### the engine (pool → frequency-rank → LLM → parse)
- write-path: `teamTrainingBrief.ts` — reads the company's `coach.dissect_generated` payloads for the last 7 days
  (bounded), pools via `aggregateDissectContent`, FREQUENCY-RANKS growth/strategy/strength (the shared team pattern),
  adds door totals (best-effort), refuses below MIN_DISSECTS=3, calls `debriefCoachV5` (controlExempt), and
  `parseTeamBrief` shape-guards the JSON. `teamTrainingBriefPrompt.ts` builds the system+user prompt + strict-JSON shape.
- read-path: a `TeamBriefResult` — `{ok:true, brief:{themes,drill,repFocus,periodLabel}}` or an honest
  `{ok:false, reason}` (insufficient / no_content / llm_empty).

### the route + the manager surface
- write-path: `team-training-brief/route.ts` (POST, MANAGER-gated, rate-limited, maxDuration 300). Page: a "Team
  training brief" card on the Coach Assessment view — Build button + themes / a runnable drill / one focus per rep.
- read-path: the manager clicks Build and gets a ready-to-run brief for tomorrow's meeting, or a clear "not enough
  sessions yet" state.

## Files
- `src/lib/coach/v5/teamTrainingBriefPrompt.ts` — prompt + types.
- `src/lib/coach/v5/teamTrainingBrief.ts` — engine + parseTeamBrief.
- `src/app/api/coach/sales-session/team-training-brief/route.ts` — manager-gated route.
- `src/app/dashboard/sales-coach/coach-assessment/page.tsx` — TeamBriefCard + the Build section.
- `src/lib/coach/v5/__tests__/teamTrainingBrief.test.ts` — parse honesty tests.

## §3.4 / §A18
- §3.4: no LLM below MIN_DISSECTS; parseTeamBrief null on malformed / no-theme-and-no-drill.
- §A18: per-rep is a coaching FOCUS not a rank; a repFocus for a rep the engine didn't include is DROPPED.

## Ripple (holistic — §6 item 5)
- Reuses aggregateDissectContent + the coach LLM caller; no schema change. The page imports the engine's result TYPE
  only (server-only module erased at build) — typecheck clean.
- Slice boundary: this is the data + manager surface. The rep-portal Training tab + materials + practice engine are
  the founder-chosen NEXT slice (flagged, not built).

## Honest limit
The brief is generate-on-demand (not scheduled/cached) — one LLM call per Build click. A nightly pre-generation + a
"since yesterday" delta are follow-ups. The per-rep focus reuses the pooled signal; a richer per-rep drill is the
Training-tab slice.
