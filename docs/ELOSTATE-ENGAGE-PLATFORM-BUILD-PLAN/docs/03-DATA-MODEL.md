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
| E8 | `agents.trigger` kind `deal_gone_quiet` (0389, no parameters) | For the "gone quiet" template: fired by the nightly job when dealRisk raises `gone_quiet` (no call in 21+ days), once per deal per quiet spell (fire key from the deal's last call), claimed in `agent_fires` before acting. Templates themselves are code, not rows: nothing is stored until the manager saves |
| E12 | `agents.trigger` kind `call_linked` and action kind `playbook` (0392) | Fired after a call is linked to a deal; claimed in `agent_fires` (fire key `call:<deal>:<call>`); the action writes `deal_element_notes` ai_suggest rows as the reviewer does |
| E9 | `on_demand_agents` (company, created_by, name, instruction, created_at, retired_at) | A manager's named instruction; never edited (a change is a new one, the old retired). Answers are not stored. Instruction text is the manager's, not a customer's — no erasure entry |
