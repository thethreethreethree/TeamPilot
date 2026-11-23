# BUILD - What changed in the pipeline this week

No migration. No env keys.

### See this week's (or last week's) changes
write-path: none.
read-path: Pipeline → Forecast → "What changed this week" → GET /api/coach/remote/prospects/changes?from&to(&repId) →
listProspects + remote_prospect_events (caller's client, paged, 100 prospects at a time) → pipelineChanges → summary +
rows (new, won, lost, moved, amount, close date pushed out / pulled in), each opening its prospect.
