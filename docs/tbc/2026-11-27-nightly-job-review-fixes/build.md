# BUILD - Nightly job review fixes

### Runner and route
write-path: deal_warning_snapshots (as before); agent_fires (the claim, before any action).
read-path: companies with timezone; skip a company recorded for its day; RUN_BUDGET_MS; remaining → 500 with the count; slots 05:15, 05:45, 06:15 UTC.

### runAgent claim
write-path: agent_runs gets the fire key only when the claim was won.
read-path: deal and can-see checks first; a failure there claims nothing.

### Drivers day
write-path: none.
read-path: the company's own day (dayIn), then 30 / 90 days back.
