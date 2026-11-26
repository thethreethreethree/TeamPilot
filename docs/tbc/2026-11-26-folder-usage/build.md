# BUILD - Folder usage

No migration. No env keys.

### A manager checks whether the team listened to a company folder
write-path: none.
read-path: Library → Company → each call "Played by 2 teammates" / "No one on the team has played it yet" ← GET /api/coach/remote/library?scope=company → listen_events (distinct listeners, not the rep).
