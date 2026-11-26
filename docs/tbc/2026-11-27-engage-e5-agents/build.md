# BUILD - Engage E5: agents

Migration 0379 (agents, agent_runs, rss_valid_agent, rss_agent_can_see; notification type agent_ran; webhook event agent.ran). No env keys.

### A manager makes an agent
write-path: Engage → Agents → New agent → POST /api/coach/remote/agents → agents (policy: leads; CHECK rss_valid_agent).
read-path: GET /agents → agents and runs.

### A deal reaches a stage
write-path: POST /prospects/:id {set stage} → stage event → after(): runAgentsForStage → each matching agent → rss_agent_can_see → actions (writeDealBrief · manager_notifications · tasks + remote_prospect_tasks · webhook_deliveries) → agent_runs.
read-path: the rep's bell (agent_ran → the deal), the deal's To do and Brief, the runs list.

### A test
write-path: POST {test, prospectId} → runAgent(test) → agent_runs (test = true), nothing else.
read-path: the run's "Would …" lines.
