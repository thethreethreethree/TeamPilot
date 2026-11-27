# BUILD - E7: people and team stats in the API; the usage report

### People in the API
write-path: none (reads profiles; each request is recorded in api_usage by readResource).
read-path: GET /api/v1/users — id, name, role, sales-coach role, status, manager, created; the key's company; no email or phone.

### Team stats in the API
write-path: none (reads session_interaction_stats; the request is recorded in api_usage).
read-path: GET /api/v1/stats?days=7|30|90 — per rep and team, the Team stats averages (teamCallStats), phone and video calls, a call with an active hide left out.

### API usage report
write-path: api_usage rows written by recordApiUsage on every API request (0378), unchanged.
read-path: GET /api/coach/remote/settings/api-keys/usage — admins: last 7 days by key and route, requests / errors / too fast; partial past 50,000 rows. Shown under the keys in Settings → API keys (ApiKeysPanel).
