# BUILD - Sandbox company

### Sandbox flag
write-path: companies.is_sandbox (0397) set by the server only (guard refuses a signed-in insert or change).
read-path: the dashboard layout reads it (best-effort) and shows "Sample data".

### Seed
write-path: scripts/sandbox/seed.mjs --apply makes the company, the admin and sample reps (auth + profiles), then rss_sandbox_seed writes accounts, contacts, deals with events, a split, calls with transcripts, deal and call contacts — refusing a non-sandbox or already-seeded company.
read-path: every page reads the sandbox as any company.
