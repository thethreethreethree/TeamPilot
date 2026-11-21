# 08 — Deployment

**ELOSTATE is your product, so it deploys on Vercel** [OBSERVED: app at elostate.com on Vercel;
the marketing site is a separate Vercel project]. The Remote Sales System ships inside the existing
app. It has no deployment of its own.

## How it goes out

1. Migrations: `npm run db:apply` only (ledger `public._agent_migrations`, checked by `db:check`,
   `db:dry`, `db:reconcile`, `verify:live`). Never apply SQL by hand.
2. Code: the normal ELOSTATE branch → Vercel preview → production path. The method and credentials
   are in BUILD-STARTER V6 `05-DEPLOYMENT-METHOD.md`. Follow that file; this plan doesn't restate it.
3. Crons: add to `vercel.json` beside the existing ones: the webhook sender (Phase 9) and the
   erasure job (Phase 8). Each checks `CRON_SECRET` and fails loudly (503) when it's missing, as
   today's crons do.
4. Env: one new key, `RSS_WEBHOOK_SIGNING_SECRET` (Phase 9). Set it in Vercel before Phase 9 ships.
   There are no payment, price, bot, dialer or CRM keys (see `.env.example`).

## Storage and quota

Remote calls are longer than door pitches. Raising the upload limit (D16) raises Supabase storage
use, and a storage-quota suspension happened this week. Before raising the limit:

- extend the health route's quota warning (`/api/health`) to fire **before** the limit, not at it;
- confirm the retention setting (Phase 8) or today's keep-last-20 purge is running on the new
  recordings.

## If it ever moves to the VPS

Not planned. ELOSTATE is a product on Vercel. If that changes, the VPS rule applies, verbatim:

> Never trust a written list of free ports, including one in this file. Survey the box and
> bind-test the port, because `ss` misses ports held by stopped units. Re-survey immediately
> before writing the service file.
