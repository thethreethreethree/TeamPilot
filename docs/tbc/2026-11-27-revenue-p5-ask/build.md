# BUILD - Revenue Phase 5: Ask Anything over a deal or an account

No migration. No env keys.

### Ask about a deal
write-path: deal panel → Ask about this deal → POST /api/coach/remote/ask {sessionIds: the deal's newest 10 calls} → askCoach (caller's access) → a stored chat.
read-path: the answer with citations (CitedAnswer) → each opens the call at the line.

### Ask about an account
write-path: account page → Ask about this account → the same route with the account's calls.
read-path: the same.
