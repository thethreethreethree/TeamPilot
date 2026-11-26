# BUILD - Ask the coach about a library folder

No migration. No env keys.

### Someone asks about a folder
write-path: Library → folder → "Ask the coach about the calls in this folder" → POST /api/coach/remote/ask {question, sessionIds (≤10)} → a saved chat (0281), as from Search.
read-path: the cited answer under the folder.
