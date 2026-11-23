# BUILD - Calendar reads the whole week

No migration. No env keys.

### See a busy week
write-path: none.
read-path: Pipeline → Calendar → GET /api/coach/remote/calendar → every remote call of the week (paged, caller's client)
→ their prospect links 100 ids at a time → buildWeek.
