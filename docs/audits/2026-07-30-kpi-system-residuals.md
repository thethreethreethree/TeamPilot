# KPI Analytics system — outside-view audit + honest residuals (2026-07-30)

The Sales-Coach KPI system was built end-to-end this session (spec: `SalesCoach-KPI-System.md`). It is
functional, tested (compute 31/31; full check 1716 green), deployed, and the cron is scheduled. Quota
Attainment + manager exception alerts (the two founder-confirmed additions) shipped 2026-07-30. This is the
honest record of what is NOT yet complete, so nothing reads as more finished than it is.

## Confirmed sound
- Understanding Gate (MIN_SESSIONS=5) is enforced *inside* every compute function — no surface can bypass it.
- Money is exact-decimal (integer cents) — tested against the classic float-drift cases.
- The computed tables (0205) are RLS-sealed service-role-write-only (allowlisted, reason on record) — a
  member cannot self-fabricate a baseline/snapshot (mirrors the 0113 ELO hardening).
- Manager rollup is sorted by name, never ranked by default (the spec's non-negotiable).

## Residuals / known limitations (ranked)

1. **Reliance Reduction counts 0-cue sessions — FIXED for the agent view (/me).** Two filters now apply:
   (a) `relianceReductionFromFirstCue` drops the leading observe-window / pre-coaching run (measure only from
   the first CUED session onward — tested); (b) /me now excludes no-coaching sessions by requiring ≥1
   transcript segment ("the coach ran"). So the slope reflects only coach-active, post-observe sessions.
   MINOR REMAINING: the manager rollup (/team) still applies only filter (a) (not the per-session segment
   check) to keep its team-wide query light — acceptable for a summary read.

2. **Self-comparison delta — DELIVERED on-read (was MEDIUM → now LOW).** The spec's #1 principle (measure vs.
   the agent's own past) is now visible: `selfDelta` splits the agent's ordered sessions in half and shows
   recent-half − prior-half per session-based metric ("▲/▼ vs earlier"), computed on-read (no cron/baseline
   table needed), gated at ≥2·MIN_SESSIONS. REMAINING (LOW): a longer-horizon rolling baseline via the
   `agent_baseline` table would need the cron to write period-stamped snapshots (currently `period='current'`)
   and populate agent_baseline from that history — a refinement over the on-read half-split, not a blocker.

3. **`/api/coach/kpi/team` computes live, not from the cron snapshots (LOW-MEDIUM).** For a large team it
   fetches all sessions + cues and computes per-agent in-memory each request. Once the cron has run, `/team`
   should read precomputed `kpi_snapshot` rows instead. (One query today, so fine at current scale.)

4. **Quota Attainment — BUILT (90c9ed14).** Founder confirmed a monthly deals-won target per rep. 0206 adds
   `companies.sales_coach_monthly_deal_target`; a manager sets it on Settings → Coaching (QuotaTargetPanel,
   manager-gated route). `/me` counts this-month `sold` sessions ÷ target. With no target set the metric
   stays "building" — no fabricated goal. EDGE (LOW, founder-gated): "this month" is a **UTC** month on both
   sides (consistent, no miscount), so for a non-UTC team a deal near a month boundary buckets by UTC, not
   local. A correct fix needs a per-company timezone setting (which zone? = founder input) — deferred, not a
   bug.

5. **Exception alerts — BUILT (c1a82439).** Founder confirmed the ≥15% threshold. `/team` flags any rep whose
   recent conversion is ≥15% below their own prior baseline (`isSlippingVsBaseline`, gated to ≥2·MIN_SESSIONS
   on both halves + a positive prior — no zero-baseline artefact; each half gates to null if it lacks
   opportunities → no false alert). Surfaced as a "worth a check-in" banner + per-rep pill, coaching-framed.
   REMAINING (LOW): it reads conversion only — quality-score slippage could be a second trigger later.

6. **Still founder-input-gated (NOT build gaps).** (a) Sales-cycle length + lead-response time need a
   first-contact / lead-created timestamp source that doesn't exist in `coaching_sessions` — a data-model
   decision. (b) Sentiment trajectory needs a new LLM scoring pass over transcript segments (propose-first
   under the guide-don't-overtake rule + an AI-cost surface). (c) Scheduled digests need email-delivery infra + cadence. (d) Excel/PDF export
   beyond the shipped CSV needs a dependency (xlsx/PDF) or a print stylesheet — CSV already covers data-out,
   so this is a shareable-report nicety, not a data gap.

7. **On-read `/me` runs 4 queries + all-layer compute per page load (LOW).** Fine now; if an agent has
   thousands of sessions the `.in(sessionIds)` cue query grows — revisit if it appears in logs.

## Recommended next order
1. Fix residual #1 (reliance signal quality — it's the headline metric).
2. Residual #2 (period-stamped snapshots → real baselines/deltas + growth_record).
3. Founder decisions to unblock #6: (a) first-contact timestamp source, (b) go-ahead on sentiment scoring,
   (c) digest email cadence, (d) whether PDF/Excel is worth a dependency over the shipped CSV.
