# BUILD - E12: fill the playbook from each call

### Call-linked trigger
write-path: agents.trigger {kind: call_linked} (0392); the deal route's "link" runs runAgentsForCallLinked after the reply, which claims agent_fires (call:<deal>:<call>) before acting.
read-path: the agent list says "When a call is added to a deal"; each run is in the agent's run history.

### Playbook action
write-path: deal_element_notes 'ai_suggest' rows through reviewPlaybook (service role, pinned to the company; only cited evidence; never over a person's note).
read-path: the deal's Playbook tab shows the AI's evidence per element for the rep to validate (unchanged).

### Template
write-path: none until Save.
read-path: "Fill the playbook from each call" under New agent: call added → read the playbook, tell the rep.
