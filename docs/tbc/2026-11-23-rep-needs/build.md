# BUILD - Rank stage practice by what the rep misses

Migration 0326 — applied to production. No env keys.

### Tag a scenario with rubric items
write-path: Remote Sales → Training → a scenario → "+ Rubric item" → PUT /api/coach/remote/scenarios/elements
{ scenarioId, elementId, on } → requireSalesCoachManager → real rubric item, company scenario → insert
training_scenario_elements.
read-path: GET scenarios/elements → items + current tags → "Trains: …" chips.

### See practice ranked on a prospect
write-path: none.
read-path: Pipeline → prospect card → GET stage-practice → stage scenarios → rankForRep: tags + the prospect's rep's last
10 scored phone/video calls' element grades (caller's client) → missRates → rankByNeeds → "Trains X — missed on N of
the last M scored calls", weakest first.
