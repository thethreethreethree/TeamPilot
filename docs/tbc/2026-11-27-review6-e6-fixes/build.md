# BUILD - Review 6 fixes

### API call upload
write-path: JSON → coaching_sessions (the call), audit_log (counted for the cap), a signed upload named after the call; finalize → audio pointer, status ended, transcript, notification.
read-path: audit_log (cap; made-by-API), profiles (the rep), the stored object's metadata.

### Answer gate
write-path: unchanged.
read-path: audit_log (made by API) and the consent event.

### Team targets
write-path: team targets only for the caller.
read-path: shown on the whole-team view.
