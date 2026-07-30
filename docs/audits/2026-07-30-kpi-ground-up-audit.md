# KPI Analytics subsystem — §1.7 ground-up audit (2026-07-30)

Foundation-up soundness review of the new KPI subsystem, outside-view stance. Each layer: solid / flagged /
missing. A flag at a lower layer is leveraged more than one above it.

## L1 — Environment / toolchain
**SOLID.** No new runtime deps. Pure compute in plain TS. `CRON_SECRET` confirmed present in prod (cron
returned 401 not 503). `NEXT_PUBLIC_BUILD_COMMIT` (unrelated) allowlisted. tsc strict (noUncheckedIndexedAccess)
passes across the subsystem.

## L2 — Schema (0205)
**SOLID.** Additive only: `coaching_sessions.deal_value numeric(14,2)` (exact-decimal money) + the computed
tables `agent_baseline` / `kpi_snapshot` / `growth_record`. `coaching_sessions.outcome` reused (pre-existing
0077; my 0205 clause was a verified no-op). Applied; `verify:live` 14/14 after apply. FLAG (LOW): `agent_baseline`
+ `growth_record` are defined but not yet populated (the on-read self-delta covers the self-comparison; a
period-stamped rolling baseline is the optional follow-up — residuals doc #2).

## L3 — RLS / authz (the tenant-integrity layer)
**SOLID.** The 3 computed tables are RLS-sealed: SELECT own-or-manager (company-scoped), and NO member
INSERT/UPDATE/DELETE — only the service-role cron writes them (mirrors 0113 anti-self-fabrication),
allowlisted in rls-audit with the reason. `verify:live` passes (no table-without-RLS). Route authz:
`/me` self-scoped (`agent_id = auth.uid()`) with RLS backstop; `/team` manager-gated + company-scoped;
`/compute-cron` CRON_SECRET-gated + service-role. All THREE gates now test-locked (401/403/503 paths).

## L4 — Compute (correctness)
**SOLID.** Pure, IO-free, 25 tests. Understanding Gate (MIN_SESSIONS=5) enforced inside every function.
Money exact-decimal (integer cents; float-drift cases tested). Reliance excludes observe-window + no-coaching
sessions (two filters, tested). Cue-to-outcome = point-biserial with a higher gate + "association not proof"
framing. Self-delta / skill-progression / consistency all derived from the same evidenced data, tested.

## L5 — Routes (integration)
**SOLID.** `/me` (auth + end-to-end compute tested), `/team` (auth + compute tested), `/compute-cron`
(idempotent per-period delete+insert; auth tested), `/outcome` (deal_value source, tested incl. schema
rejection). FLAG (LOW): `/me` runs 4+ queries per load; fine at current scale, revisit for a very heavy agent
(residuals #5).

## L6 — Surface (honesty + discoverability)
**SOLID.** Nav item present; every metric reads "building…" until real data (no fabricated numbers); drill-down
traces each number to its sessions; manager rollup sorted by name, never ranked by default (spec non-negotiable);
correlation labelled "association, not proof". Jeff's product knowledge teaches the feature (content-locked).

## Verdict
No layer is broken. All flags are LOW and already tracked in the residuals audit. The subsystem is sound
foundation-up; the remaining work is external-input-gated (quota target, first-contact source, alert
thresholds, or a founder-scoped new scoring pass), not structural.
