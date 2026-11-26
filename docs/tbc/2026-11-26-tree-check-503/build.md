# BUILD - A failed tree check says so

No migration. No env keys.

### A manager opens a rep while the tree check fails
write-path: none (team role change: nothing written).
read-path: /recordings, /rep-activity, /skills, /elo ?agentId=, POST /team → treeAllowsRepChecked → null → 503 "Couldn't check your team right now. Try again."
