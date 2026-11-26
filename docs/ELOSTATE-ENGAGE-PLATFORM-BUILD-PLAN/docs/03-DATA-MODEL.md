# 03 — Data model

Append-only, RLS by company plus the tree, MFA restrictive, erasure where customer words land.

| Phase | Table | Notes |
|---|---|---|
| E1 | `engage_flows` (company, owner, name, is_company, steps jsonb, retired_at) | Steps checked by `checkSteps`; a change is a new flow (like brief templates) |
| E1 | `engage_enrolments` (flow, prospect, contact, rep, created_by) | Unique among live enrolments (flow, contact); state is the replay of activities |
| E1 | `engage_activities` (enrolment, step index, action, outcome key, note, actor) | Append-only; the note and the email body can hold customer details, so erasure blanks them |
| E3 | `api_keys` (company, name, key_hash, scopes, created_by, revoked_at) | The key is shown once; only its hash is stored |
| E3 | `api_usage` (key, route, status, at) | For the usage report and rate limits |
| E4 | `mcp_keys` (user, key_hash, revoked_at) | Acts as that user |
| E5 | `agents` (company, owner, trigger jsonb, actions jsonb, enabled) and `agent_runs` (agent, subject, ok, actions, at) | Runs as the owner |
