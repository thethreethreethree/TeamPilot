# BUILD - Engage E3: the public read API

Migration 0378 (api_keys, api_usage). No env keys.

### An admin makes a key
write-path: Protection → API keys → Make a key → POST /api/coach/remote/settings/api-keys → newApiKey (hash only) → api_keys (service role, admin-checked); audit api_key.create.
read-path: GET → keys with 24-hour use; the key itself is shown once.

### A tool reads the API
write-path: every request → api_usage.
read-path: GET /api/v1/{deals|accounts|contacts|calls} → authenticateApiKey (hash, scope, per-second, daily) → company-pinned reads; calls minus hidden ones.

### Revoking
write-path: POST {revoke} → revoked_at (the one change the guard allows); audit api_key.revoke.
read-path: the key answers 401 from then on.
