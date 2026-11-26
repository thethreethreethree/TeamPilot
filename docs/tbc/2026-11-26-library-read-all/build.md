# BUILD - The library reads every item

No migration. No env keys.

### Someone opens a large library
write-path: none.
read-path: GET /api/coach/remote/library → every item (paged, by folder chunks) → removals (paged, chunked; failure 500) →
the newest 300 remaining → { items, truncated } → "Showing the 300 most recently saved. Older ones are still here — find them in Search."
