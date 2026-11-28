# BUILD - E15–E18 review fixes

### Key gate order
write-path: api_usage 403 rows as before; they no longer count toward the daily limit (neq 403).
read-path: authenticateApiKey: valid key → per-second → trusted address → scope → daily.

### Mapped addresses
write-path: api_keys.allowed_ips stores ::ffff:a.b.c.d entries as a.b.c.d (normalizeEntry).
read-path: inRange matches them as IPv4.

### Library resource
write-path: none.
read-path: GET /api/v1/library reads library_folders_current (current parents), hides archived folders and everything inside them (archivedFolderIds, underArchived), and says snippetId.

### Deep Ask
write-path: none.
read-path: askCoachDeep opens every call first (skipped and counted), runs the batches at once, keeps non-citation brackets as text and uncited answers in the combine; the Ask box says how many were left out.
