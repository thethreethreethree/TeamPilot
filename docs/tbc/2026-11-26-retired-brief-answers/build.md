# BUILD - A retired template's answers stay viewable

No migration. No env keys.

### Someone opens Briefs on a call a retired template answered
write-path: none.
read-path: GET /api/coach/remote/brief-templates?sessionId= → live templates + custom_briefs template ids for that call (caller's client) → those retired templates (company-pinned) → "(retired)" in the picker → GET /[id]/custom-brief → the stored answers, no run button.
