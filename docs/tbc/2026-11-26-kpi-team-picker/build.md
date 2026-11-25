# BUILD - KPI team table: pick one manager's team

No migration. No env keys.

### A manager narrows the KPI team table
write-path: none.
read-path: Sales Coach → KPI → Team (manager view) → "Showing [Theo's team (3)]" → GET /api/coach/kpi/team?team=<id> →
rows for that manager and the people below them; the headline cards are unchanged.
