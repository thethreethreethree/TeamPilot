# BUILD - Nightly revenue job

### 0382 and the runner
write-path: deal_warning_snapshots (service role only; once per deal per day); agent_runs.fire_key (once per agent, deal and close date).
read-path: listProspects(admin, undefined, { companyId }) per company; dealRisk per open deal.

### Cron route
write-path: through the runner.
read-path: CRON_SECRET Bearer; 503 until set; 500 with counts when a company was skipped.

### Drivers 30 / 90 days
write-path: none.
read-path: /api/coach/remote/deal-drivers (snapshots under the caller's RLS) → driversFromSnapshots.

### Close-date agents
write-path: agents (trigger close_date_near, checked by rss_valid_agent).
read-path: the editor and the agents list say when it runs.
