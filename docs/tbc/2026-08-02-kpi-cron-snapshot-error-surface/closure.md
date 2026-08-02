# CLOSURE — KPI compute-cron snapshot-error surfacing

## What shipped
The scheduled KPI persistence cron no longer swallows a snapshot insert failure. On failure it logs the
agent/metric/period, increments a `snapshotErrors` counter, and returns it — so a dropped KPI is visible
instead of silent. This closes the swallowed-write-error class across all 7 crons (finance deliver-cron was
the previous instance).

## Un-named reliance (not self-evident)
- **The cron is DORMANT** (503 until CRON_SECRET is set + scheduled), so this changes no production behavior
  today. It matters when KPI persistence is activated.
- **The metric VALUES are unchanged** — this is purely about surfacing a write failure. Do not read this
  commit as touching how any KPI is computed.
- **The delete-then-insert data-loss window still exists** (a failed insert leaves a one-cycle gap, self-healed
  next run). It is now VISIBLE but not eliminated; eliminating it needs a unique constraint + upsert
  (`kpi_snapshot` has none today) — a migration, deliberately left founder-gated. The invariant to preserve
  meanwhile: *never delete a snapshot without surfacing a failed re-insert.*

## Flagged, not fixed (§3.3 — each is a decision, not a mechanical fix)
1. `sessionsPerDay` buckets days in UTC (compute.ts:125) → distorts the metric for non-UTC reps; runs live in
   the on-read view. Needs a timezone source + a product call on which zone defines "a day". → founder queue.
2. `kpi_snapshot` missing unique(agent_id, metric, period) → delete-then-insert instead of upsert. → migration,
   gated.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No live end-to-end test of the snapshotErrors path against a real kpi_snapshot write — only the mocked route test and typecheck.", "why_skipped": "Cron is 503-dormant until CRON_SECRET; the mocked test (kpi compute-cron __tests__, commit b25166b0) already drives the failure branch.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-02T00:50:00Z", "outcome": "OPENED — the mocked test forces every insert to error and asserts snapshotErrors=12 + console.error called; adequate coverage for a dormant path, live is founder-activated." },
  { "id": "RES-02", "item": "The delete-then-insert data-loss window is now VISIBLE but not eliminated (a failed insert still leaves a one-cycle gap).", "why_skipped": "Eliminating it needs unique(agent_id,metric,period) + upsert = a migration, founder-gated; the gap self-heals next run and is now surfaced.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null }
]
```
