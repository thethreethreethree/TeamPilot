# BUILD - Suggest the stage names already in use

No migration. No env keys.

### Type a prospect's stage
write-path: unchanged — the stage name is saved as typed (POST prospects/:pid set stage).
read-path: Pipeline → prospect card → Stage name box → datalist "stage-names-in-use" ← stagesInUse(the pipeline's
prospects) → one spelling per name (the most used).
