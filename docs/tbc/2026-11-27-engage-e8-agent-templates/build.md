# BUILD - E8: agent templates; the gone-quiet trigger

### Agent templates
write-path: none until the manager presses Save, which posts to /api/coach/remote/agents (unchanged, checked by agentSchema and rss_valid_agent).
read-path: AGENT_TEMPLATES (code) shown as chips under "New agent" in Engage → Agents; a chip fills the editor.

### Gone-quiet trigger
write-path: agents.trigger {kind: deal_gone_quiet} (0389); the nightly job claims agent_fires (quiet:<deal>:<last call>) before running the agent.
read-path: quietFires reads dealRisk's gone_quiet verdict for open deals; the agent list says "When an open deal goes quiet — no call in 21 days".

### On-demand agents table (for E9)
write-path: on_demand_agents insert by a sales-coach manager (RLS), retire only (guard trigger); no delete.
read-path: the company's members (RLS select); the E9 routes and deal Ask box read it next.
