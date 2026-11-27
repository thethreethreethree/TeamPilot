# BUILD - E7–E9 review fixes

### Usage report paging
write-path: none (api_usage is written by recordApiUsage, unchanged).
read-path: GET /api/coach/remote/settings/api-keys/usage pages newest first by id (each page below the last id seen), so a request logged during the read is never counted twice.

### Usage report "partial"
write-path: none.
read-path: at the 50,000-row cap the route checks for one more row; the panel says "partial" only when the week really had more.

### Gone-quiet wording and first night
write-path: none (agent saves unchanged).
read-path: the editor, the agent list and the template say "no call in 21 days, or none after 14 days in the pipeline" (dealRisk's QUIET_DAYS and NEW_GRACE_DAYS), and the editor says the first night runs on every deal already quiet.

### On-demand agents
write-path: retiring no longer clears a half-typed new agent; the run's rate limit has its own id, 20 a minute.
read-path: unchanged.
