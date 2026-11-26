# BUILD - The reporting-tree audit sees every manager check

No migration. No env keys.

### A manager outside a rep's chain asks for that rep
write-path: none.
read-path: /recordings, /rep-activity, /skills, /elo ?agentId=<rep> → treeAllowsRep → 404 "Rep not found in your team."; /team-activity and
/coach-assessment → treeFilterReps → only reps in the chain.
