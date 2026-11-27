# BUILD - Upload a call by API

### POST /api/v1/calls
write-path: coaching_sessions (createSession for the rep; audio pointer, company-pinned; status ended), storage (the recording), transcript (unknown voices), manager_notifications (call_needs_voice), audit_log (call.api_upload), api_usage.
read-path: the key (scope "upload"), the rep (profiles, the key's company, active).

### Shared transcription
write-path: unchanged from the upload route (moved, not copied).
read-path: the company vocabulary.

### Pick your voice
write-path: consent event, then attribute-unlabelled (owner-only), which scores the call.
read-path: the call's segments (all unknown → shown).
