# BUILD — new metrics on the manager roster

### Per-agent Objections + Uptake from the SAME payload read
- write-path: `team/route.ts` — the existing team after_pitch_summaries read gains `agent_id`; its loop now also
  builds `objectionRowsByAgent` (via objectionInputFromPayload, nulls excluded) and `recRowsByAgent` (via
  recommendationInputFromPayload + a session→started_at map from sessRows). Each agent gains three aggregate
  MetricResults from the same functions as /me.
- read-path: a manager sees per-rep Objections /call + Recommendation-uptake %, matching each rep's own /me numbers.

### Roster + CSV render
- write-path: `kpi/page.tsx` — the TeamAgent type gains the 3 optional MetricResults; the roster row renders an
  "Objections" column (value/call, resolution rate as a tooltip) + an "Uptake" column; the team CSV gains 3 columns.
- read-path: the manager compares the metrics across reps in the roster and in the exported sheet; "building…" where gated.

### Privacy (A18)
- write-path: only aggregate MetricResults are added — no raw per-session scores or payload echo.
- read-path: the A18 allow-list test enforces the exact key-set; the raw-score-leak assertions (91/42/"payload")
  still pass, so a future leak fails a test.

## Files
- `src/app/api/coach/kpi/team/route.ts` — per-agent objections + uptake from the existing payload read
- `src/app/dashboard/sales-coach/kpi/page.tsx` — TeamAgent type + roster columns + CSV columns
- `src/app/api/coach/kpi/team/__tests__/route.authz.test.ts` — A18 allow-list updated (aggregates only)

## Ripple (§6 item 5)
- No new query (agent_id added to an existing select); no schema/data change. Same functions + gates as /me, so
  cross-view numbers agree. The privacy contract is preserved (aggregates only) and its guard updated consciously.
- The rep /me view is untouched.

## Honest limit (verify)
- The roster rendering the two new columns over live data is founder visual-verify (no jsdom harness for this
  client page). The route computation is unit-covered (team route tests, incl. the A18 privacy guard) + typecheck.
- Objections will read "building" on the roster until sessions re-analyze with the tally (same as /me); Uptake
  populates now for reps with enough flagged-then-rescored pairs.
