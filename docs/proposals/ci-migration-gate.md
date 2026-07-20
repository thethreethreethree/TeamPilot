# Proposal: CI migration-execution gate

**Status:** PROPOSED (founder decision — not wired). **Date:** 2026-07-20.
**Trigger:** `0175_fin_cash_forecast` shipped referencing `fin_recurring_bills.memo` — a column that table
never had — and passed *every* existing gate (`tsc`, `lint`, `theme`, `rls`, `invariant`, `test`, `build`),
because none of them parse SQL. It failed only when applied to a live database, days after it was written.

## The gap

`.github/workflows/ci.yml` has one job (`check`) running the six `npm run check` gates + `build`. **None
executes migration SQL.** A migration with a bad column/table reference, a broken view, or a bad function
body is invisible to CI and surfaces only on `db:apply`. `npm run db:verify` (added 2026-07-20) is the manual
guard, but it is opt-in and points at the prod DB. The durable fix is CI executing every migration on every
PR, against a throwaway database.

## The crux (verified, and it rules out the naive approach)

A bare `postgres:16` service container will **not** work. Verified against the migration set:

- **110 of 187 migrations reference the Supabase `auth` schema** — 368 `auth.uid()` calls, 101 `auth.users`
  references. `auth` is provided by Supabase (GoTrue), not by vanilla Postgres.
- **29 references to the `storage` schema** — also Supabase-provided.

So any "spin up Postgres, apply migrations" job fails on the first `references auth.users(id)` /
`auth.uid()`. The environment must reproduce Supabase's `auth` + `storage` schemas.

## Recommended design: use the Supabase CLI (already a dependency)

`supabase ^2.104.0` is already in `package.json`, and `supabase/config.toml` + `supabase/migrations/NNNN_*.sql`
are already in the CLI's expected layout. The CLI's local stack provides the `auth`/`storage` schemas, and
**`supabase db reset` applies every migration in `supabase/migrations/` to a fresh local database in order** —
that is precisely the from-scratch migration test we want. It fails the job if any migration errors.

Drafted second job for `ci.yml` (review before merging — see the unverified boundary below):

```yaml
  migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - name: Start local Supabase database
        run: supabase db start        # boots Postgres + auth/storage schemas (Docker; Actions has it)
      - name: Apply all migrations from scratch
        run: supabase db reset         # replays supabase/migrations/*.sql in order; nonzero exit on any error
```

This touches **no production data** — the DB is an ephemeral container discarded with the runner. It is purely
additive to CI; it does not change the existing `check` job.

## What I could NOT verify (the honest boundary)

I cannot run Docker or GitHub Actions from this environment, so **the drafted job above is unexercised.** Open
questions a real CI run must answer before this is trusted:

1. Does `supabase db reset` complete against *this* `config.toml` without a `seed.sql`, or does it expect one?
2. Is `supabase db start` sufficient, or is the fuller `supabase start` needed for some migrations' dependencies?
3. Do any migrations depend on Supabase objects created by the CLI's own internal migrations vs. our
   `supabase/migrations/` (e.g. `storage.objects` shape)? The 29 `storage.` refs should be checked.
4. Runtime/cost: `db start` pulls Docker images — first run is slow. Cache or accept it.

**Recommendation:** add the job **as non-blocking first** (`continue-on-error: true`) for a few PRs, watch it
go green on real runs, then flip it to blocking. Shipping it blocking-and-unverified would red-wall every PR
if question 1–3 bites — the opposite of helpful.

## Note on `scripts/db-apply.mjs`

The apply tool and this gate are complementary, not overlapping: `db-apply` manages the **prod** ledger
(`public._agent_migrations`) for real applies; this gate proves migrations run **from scratch** on a throwaway.
`db:verify` sits between them — it proves the *pending* batch runs against the *current live* schema before a
real apply. Three layers, three jobs.
