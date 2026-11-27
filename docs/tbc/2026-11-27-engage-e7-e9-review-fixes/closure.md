# CLOSURE - E7–E9 review fixes

## What is true now

The usage report counts each request once and says "partial" only when it is; a gone-quiet agent says exactly when it
runs, including its first night.

## Residual

```json
[
  {"id": "R1-unlinked-call", "item": "If a deal's newest call is unlinked, its last-call time falls back to an older one whose quiet spell may already have fired, so that spell isn't fired again.", "why_skipped": "Rare (unlinking a call from a deal), and the miss is one notification, never a doubled one.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-27T04:04:00Z", "outcome": "Recorded."},
  {"id": "R2-stats-90-cap", "item": "/api/v1/stats?days=90 answers 500 for a company past 50,000 interaction-stat rows in 90 days (the pager refuses rather than returning part).", "why_skipped": "No company is near it; the honest failure beats a short count; a SQL aggregate would replace it when one is.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T04:04:00Z", "outcome": "Recorded."},
  {"id": "R3-created-at", "item": "on_demand_agents.created_at can be set by the inserting manager (as on agents).", "why_skipped": "It only orders the list; nothing is decided by it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T04:04:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
