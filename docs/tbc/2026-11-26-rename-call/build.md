# BUILD - Rename a call from its page

No migration. No env keys.

### The rep renames an uploaded call
write-path: call page → "Rename call" → "Acme renewal" → Save → PATCH /api/coach/sales-session/<call> {clientLabel} →
renameSession (owner-only, existing).
read-path: the page header, call lists and Search show "Acme renewal".
