# BUILD - Idempotency-Key

### POST /api/v1/calls
write-path: the audit record carries meta.idem.
read-path: an earlier call.api_upload for this key with the same idem in 24 h → returned.
