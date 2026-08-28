# BUILD — Follow-up + Sales cycle on the manager roster

### Per-agent prospect metrics from the existing session read
- write-path: `team/route.ts` — `client_label` added to the team session select; the byAgent loop also builds
  `prospectRowsByAgent` (via prospectKeyOf); each agent gains `followUpRate` + `salesCycleLength` (same functions
  + gates as /me).
- read-path: a manager sees per-rep Follow-up % + Cycle (days), matching each rep's own /me numbers.

### Roster + CSV render
- write-path: `kpi/page.tsx` — TeamAgent type gains the 2 optional MetricResults; the roster row renders Follow-up
  + Cycle columns; the team CSV gains 2 columns.
- read-path: manager compares across reps in the roster + exported sheet; "building…" where gated.

### Privacy (A18)
- write-path: only aggregate MetricResults added — no raw session data.
- read-path: the A18 allow-list test enforces the exact key-set; raw-leak assertions still pass.

## Files
- `src/app/api/coach/kpi/team/route.ts` — client_label in the select + per-agent prospect metrics
- `src/app/dashboard/sales-coach/kpi/page.tsx` — TeamAgent type + 2 roster columns + 2 CSV columns
- `src/app/api/coach/kpi/team/__tests__/route.authz.test.ts` — A18 allow-list +2 aggregate keys

## Ripple (§6 item 5)
- No new query (client_label added to an existing select); same functions + gates as /me → cross-view numbers
  agree; privacy contract preserved (aggregates only) and its guard updated consciously. The rep /me view is untouched.

## Honest limit (verify)
- The roster rendering the 2 new columns over live data is founder visual-verify (no jsdom harness). The per-agent
  computation is unit-covered (team tests incl. A18) + typecheck. Sales cycle reads "building" for reps with <5
  sold prospects (same honest gate as /me).
