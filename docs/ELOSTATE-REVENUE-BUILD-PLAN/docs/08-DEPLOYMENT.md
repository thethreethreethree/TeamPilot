# 08 — Deployment

- **Hosting:** Vercel. Pushing `main` deploys. Migrations go only through `npm run db:apply` (dry run first), then `npm run verify:live`.
- **External precondition (§1.5.3):** the nightly warning and activity jobs (Phases 3–4) need `CRON_SECRET` and a Vercel cron entry. `CRON_SECRET` is an open BUILD-STATE carry-over. Until it's set, the board shows "Warnings last checked: never", which is loud, not silent.
- **AI:** the reviewer and the brief use the existing engine and its cost ledger. There are no new keys.
