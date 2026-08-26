# BUILD — manager dashboard: per-rep door metrics

### per-rep door KPI in the manager route (best-effort)
- write-path: `coach-assessment/route.ts` — the per-rep parallel block adds `getAllTimeKpi(a.id).catch(()=>null)`
  (BEST-EFFORT: null on any error, never a false 0, never degrades the coaching page). `doorKpi:{doorsKnocked,
  presentations,sold}|null` added to `Agg` and each `team` item.
- read-path: the manager view receives each rep's all-time door activity alongside their coaching signal.

### the display (labelled activity, A18)
- write-path: `coach-assessment/page.tsx` — `AgentAssessment.doorKpi` + a compact `<DoorMetrics>` row on each rep card
  ("🚪 N knocked · N presentations · N sold"), rendered only when doorsKnocked > 0. The "no coached sessions yet" list
  is now per-rep and shows door metrics too (an active rep with no assessable session still shows they're working).
- read-path: the manager sees each rep's door ACTIVITY — objective results, alphabetical, not a coaching leaderboard.

## Files
- `src/app/api/coach/sales-session/coach-assessment/route.ts` — per-rep getAllTimeKpi (best-effort) + doorKpi field.
- `src/app/dashboard/sales-coach/coach-assessment/page.tsx` — DoorMetrics component + per-rep no-content list.

## Data provenance (§0 / verified)
`getAllTimeKpi` returns {doorsKnocked, presentations (= doorsKnocked − no_answer), sold}, cap-safe from rep_kpi_daily.
Real numbers confirmed (95/46/20, 126/30/3, …). rep_kpi_daily is rep+manager RLS → a manager reads team rows.

## A18 boundary
Team-analytics stays aggregate-only. This adds per-rep OBJECTIVE ACTIVITY (not the growth-based coaching grade) to the
per-rep Coach Assessment view, labelled "door activity", alphabetical — leader-visibility of results, not a ranked
coaching board.

## Ripple (holistic — §6 item 5)
- Additive best-effort query + a display field; the coaching degrade path unchanged. No schema/auth change.
- 3 coach-assessment tests still pass (the .catch keeps the team response intact when the KPI read isn't mocked).

## Honest limit
All-time totals (matches the existing dashboard bubbles). A per-period toggle (this week/day) is a follow-up, not
built here to keep the P1-adjacent scope tight.
