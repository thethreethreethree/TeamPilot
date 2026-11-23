# REMEDIATE - Deal sentiment

### F1 - no call is linked to a prospect in production yet
Nothing is shown rather than a made-up reading; reps link a call with "Add to pipeline" on the call page.
gate-or-promise: promise (OPEN.md "deal sentiment appears once calls are linked to prospects")

### F2 - events.id is a uuid
Fixed before commit.
gate-or-promise: gate (dealSentiment.test.ts orders by time with string ids)
