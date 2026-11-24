# REMEDIATE - Practice scenario drafted from a real call

### F1 - a drafted scenario could carry the customer's personal details past erasure
Prompt forbids them; stripPersonalDetails removes emails, links and 4+ digit runs; the manager reviews.
gate-or-promise: gate (callScenarioDraft.test.ts, draft route test)

### F2 - the "from this call" path was unreachable
ScenarioFromCallLink on the call page.
gate-or-promise: promise (one link)
