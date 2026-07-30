# KPI Analytics system — outside-view audit + honest residuals (2026-07-30)

The Sales-Coach KPI system was built end-to-end this session (spec: `SalesCoach-KPI-System.md`). It is
functional, tested (compute 17/17; full check 1683 green), deployed, and the cron is scheduled. This is the
honest record of what is NOT yet complete, so nothing reads as more finished than it is.

## Confirmed sound
- Understanding Gate (MIN_SESSIONS=5) is enforced *inside* every compute function — no surface can bypass it.
- Money is exact-decimal (integer cents) — tested against the classic float-drift cases.
- The computed tables (0205) are RLS-sealed service-role-write-only (allowlisted, reason on record) — a
  member cannot self-fabricate a baseline/snapshot (mirrors the 0113 ELO hardening).
- Manager rollup is sorted by name, never ranked by default (the spec's non-negotiable).

## Residuals / known limitations (ranked)

1. **Reliance Reduction counts 0-cue sessions — PARTIALLY FIXED (was MEDIUM → now LOW).** The biggest skew
   was fixed: `relianceReductionFromFirstCue` now drops the leading observe-window / pre-coaching sessions
   (measures the slope only from the agent's first CUED session onward) — tested. RESIDUAL: a session AFTER
   the first cue where the rep simply didn't use the live coach also reads 0 cues and still counts; cleanly
   excluding it needs a per-session coach-active flag (e.g. ≥1 transcript segment), which would add a query
   to /me — deferred as a smaller refinement.

2. **`agent_baseline` + `growth_record` are defined but NOT yet populated (MEDIUM).** `delta_vs_baseline`
   (current vs. the agent's own rolling history) is the spec's self-comparison core, but it needs a TIME
   SERIES of snapshots to average. The cron currently writes `period='current'` (overwrites). To compute a
   real baseline: have the cron write period-stamped snapshots (e.g. ISO week) so history accumulates, then
   populate `agent_baseline` from that history. Until then the dashboard shows current values without a
   baseline delta.

3. **`/api/coach/kpi/team` computes live, not from the cron snapshots (LOW-MEDIUM).** For a large team it
   fetches all sessions + cues and computes per-agent in-memory each request. Once the cron has run, `/team`
   should read precomputed `kpi_snapshot` rows instead. (One query today, so fine at current scale.)

4. **Metrics still `building` for lack of a source, not lack of data (LOW — founder-gated).** Sales-cycle
   length + quota attainment need a first-contact timestamp + a quota TARGET; talk-to-listen needs transcript
   segment durations wired; objections/session needs an objection source. These render "building" honestly.

5. **On-read `/me` runs 4 queries + all-layer compute per page load (LOW).** Fine now; if an agent has
   thousands of sessions the `.in(sessionIds)` cue query grows — revisit if it appears in logs.

## Recommended next order
1. Fix residual #1 (reliance signal quality — it's the headline metric).
2. Residual #2 (period-stamped snapshots → real baselines/deltas + growth_record).
3. Then the founder-gated Layer-1 metrics (#4) once targets/sources are decided.
