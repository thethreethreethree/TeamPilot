# Migrations

Sequential SQL migrations (`NNNN_slug.sql`), applied in order. Idempotent by convention
(`create or replace`, `drop … if exists` before `create`, `on conflict … do nothing`) so a
re-run is a clean no-op — see ThinkerThinker.md **A12**.

## Before you write or review a migration: the constitutional invariants

The constitution's structural core is enforced HERE, in the schema — as `do instead nothing`
rules, column-freeze triggers, the Understanding-Gate trigger, and `security definer`
search_path pins — not in application code, so it can't be bypassed. **`npm run check` does
NOT verify these stay in place.** A migration that drops one passes the green gate while
silently removing a constitutional guarantee (§5, at the schema layer).

**The rule:** if your migration touches any object listed in
[`docs/constitutional-db-invariants.md`](../../docs/constitutional-db-invariants.md) — any of
the 22 append-only tables, the 5 column-freeze triggers, the `problems_understanding_gate`
trigger, a `security definer` function's search_path, or the vendor/authz guard triggers —
**confirm the invariant survives your change**, and update the registry if you add a new one.

Quick self-check for the append-only set (should stay ≥ 22):

```
grep -rhoE "on (update|delete) to [a-z_]+ do instead nothing" *.sql | sort -u | wc -l
```

New `security definer` function? It MUST `set search_path = public` (A23 / migration 0088's
lesson). New event kind emitted into `events` but not mapped to a signal? Document it as an
`enabled=false` `signal_sources` row so it's a legible deferral, not an accidental orphan
(the 0026 / 0099 discipline).

## Applying migrations

Use `scripts/db-apply.mjs` (added 2026-07-20) — a direct Postgres connection using the
credentials already in `.env.local`. The workflow, safest step first:

```
npm run db:check     # pure read: connection + ledger state + live-object probes. NO writes.
npm run db:dry       # list the migrations that would apply (ledger vs. files on disk). NO writes.
npm run db:verify    # run the whole pending batch in one transaction, then ROLL BACK. Proves it
                     # executes against the live schema; commits nothing. Run this before applying.
npm run db:apply     # apply pending migrations, each in its OWN transaction (rollback on failure).
```

**The ledger** is `public._agent_migrations` (our own table, not the Supabase CLI's). Applied
state lives there — never infer "what's applied" from memory or these notes; run `db:check`.

**Connection:** prefers `SUPABASE_DB_URL` (paste the IPv4 "Session pooler" string from the
dashboard → Settings → Database); falls back to the direct `db.<ref>.supabase.co:5432` built
from `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` (IPv6, may not route from some networks —
`db:check` will say so).

**If `db:apply` fails on migration N:** that migration rolled back (nothing partial committed) and
the run stopped; migrations before N are applied and ledgered. **Diagnose, do not retry** (§2):
read the error, fix the migration's SQL, then re-run `db:apply` — it resumes at N because the
earlier ones are already in the ledger. Worked example: 0175 failed with `column r.memo does not
exist` — `fin_recurring_bills` (0140) has `description`, never `memo`; the view had been
latent-broken since written because it had never run anywhere. Corrected to `r.description`, re-ran,
resumed clean. (This is also why `db:verify` exists — it surfaces that class *before* a real apply.)

**First-run baseline (already done, here for the record):** the tool was introduced after 0001–0172
had been applied by hand with no ledger, so the ledger was seeded via `db:baseline=0172` (marks
0001–0172 as already-applied from verified live-object probes, without re-running them) before the
first real `db:apply` of 0173→0187. Baseline is once-only; the tool refuses to re-run it.
