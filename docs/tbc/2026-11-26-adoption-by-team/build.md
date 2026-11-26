# BUILD - Message adoption by team

No migration. No env keys.

### A manager compares how each team says the tracked messages
write-path: none.
read-path: Trackers → "How often each message is said" → By team → GET /api/coach/remote/trackers/adoption-board?days=&by=team → teams (teamsIn of the org chart, limited by treeFilterRepsChecked) → each message's rate per team (computeAdoption over that team's calls).
