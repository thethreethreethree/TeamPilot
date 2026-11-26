# BUILD - The KPI headline cards follow the team picker

No migration. No env keys.

### A company admin looks at one manager's team
write-path: none.
read-path: Sales Coach → KPI → Company → Team section → "Showing: Max Manager (3)" → GET /api/coach/kpi/me?scope=company&team=<manager>
→ the header reads "One team's results, pooled — the manager picked below and everyone under them"; the cards are that team's.

### A sales-coach manager who isn't a company admin opens KPI
write-path: none.
read-path: GET /api/coach/kpi/me?scope=company → scope "self", canPool false → "compared to your own past" and no Company switch.
