# BUILD - E11: meeting prep

### Next-call-tomorrow trigger
write-path: agents.trigger {kind: next_call_tomorrow} (0390); the nightly job claims agent_fires (nextcall:<deal>:<date>) before running the agent.
read-path: nextCallFires reads each open deal's next_call_date against the company's tomorrow (dayIn + 1); the agent list says "The day before an open deal's booked call".

### Meeting prep template
write-path: none until Save (posts to /api/coach/remote/agents, checked by agentSchema and rss_valid_agent).
read-path: the "Meeting prep" chip under New agent fills the editor: next call tomorrow → write the brief, tell the rep.
