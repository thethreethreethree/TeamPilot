# BUILD - The pipeline reads every prospect

No migration. No env keys.

### Someone opens a pipeline of more than 500 deals
write-path: none.
read-path: listProspects → remote_prospects_current (paged, created_at desc, id desc) → to-do links and to-dos in chunks of 150 → deal sentiment links in chunks of 150 → every pipeline view.
