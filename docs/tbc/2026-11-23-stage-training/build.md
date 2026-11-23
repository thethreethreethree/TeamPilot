# BUILD - Training by deal stage

Migration 0310 (applied). No env keys or dashboard settings.

### Set which stages a scenario is for
write-path: Remote Sales → Training → Scenarios → "+ Stage" (TrainingManager; names already used on prospects offered)
→ PUT /api/coach/remote/scenarios/stages { scenarioId, stage, on } (managers; company-pinned) → append to
training_scenario_stages (stage_key = rss_stage_key, checked by the database). "×" appends an untag event.
read-path: GET /api/coach/remote/scenarios/stages → training_scenario_stages_current (latest per scenario and key, on);
chips under each scenario.

### Practice for a prospect's stage
write-path: Pipeline → open prospect (own, open, stage set) → "Practice for “<stage>”" → Practice → POST
/api/coach/remote/stage-practice { prospectId, scenarioId } → checks through the caller's client (own prospect, open,
scenario tagged with its stage and active) → training_assignments insert (assigned_by = rep, due = next call day or +3
days); a second start returns the same assignment.
read-path: the role-play opens with ?assignment=; "Assigned to you" says "you started this"; the manager's Assigned
practice table says "(self-started)"; attempts record and score like any assignment.
