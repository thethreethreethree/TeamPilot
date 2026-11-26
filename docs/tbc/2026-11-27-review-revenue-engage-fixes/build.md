# BUILD - Review fixes

### 0381
write-path: accounts_select (current account), contacts_select (no account branch), agent_runs.session_id / tracker_id with a unique once-per-call index, checks refusing forecast notes and deal names in agent payloads.
read-path: unchanged views; the policies are read under the caller's RLS.

### Code
write-path: agents.ts (once per call, hidden-from-owner skip, stageChanged, no deal name), forecast route (no note).
read-path: brief GET and MCP get_deal drop a brief quoting a hidden call (basisSessions); playbook GET drops AI reads citing one (withoutHiddenReads); forecast reads every page; dealRisk ghosted counts from the deal's start.
