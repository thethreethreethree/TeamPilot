# BUILD

## Files

**`scripts/sql/supabase-shim.sql`** (new) — the smallest stand-in for what Supabase provides
before any project migration runs. Its contents are justified by a grep of what the 252
migrations actually touch, not by guessing:

```
448  auth.uid()      98  auth.users     17  storage.objects
  9  storage.foldername  6  storage.buckets   3  auth.jwt()
```

**`scripts/migration-apply-audit.mjs`** (new) — creates a scratch database, applies the shim,
then applies all 252 migrations **twice**.

| Pass | Meaning | Grading |
|---|---|---|
| fresh apply | can this reach production at all? | **fatal** |
| re-apply | A12, safe-to-re-run by construction | 18 baselined; fails on a **new** one |

**`package.json`** — `migration:audit`, added to `check` after `reachability:audit`.

**`.github/workflows/ci.yml`** — a `postgres:16-alpine` service with a health check, and the step
that uses it. Job timeout 10 → 15 minutes.

## Two passes, graded differently, and why

A migration that cannot apply is a deployment blocker whatever the tests say — that is the
2026-09-21 case and it is fatal.

Re-runnability is A12, captured in June after 0021 and 0022 both failed live on "already exists".
**18 of 252 still are not re-runnable** — all `create policy` / `create type` / `create index`
without a matching `drop … if exists`. They have RUN in production, so they are append-only and
must not be edited to fix a problem that is already in the past. They are a named baseline, and
the gate fires only when a new one appears. Fixing history is a separate build; stopping the
bleed is this one.

The script also reports when a baseline entry starts passing, so the list shrinks instead of
calcifying.

## Two portability bugs, both found by running it

**It assumed a `postgres` database exists.** True on a stock server and in CI, false on a
container whose `POSTGRES_DB` is something else — which is the machine I was on. The first run
reported **SKIPPED on a machine that had Postgres running the whole time**, which is the exact
false-negative this script exists to eliminate. Now `MIGRATION_AUDIT_MAINT_DB`.

**It assumed psql on PATH.** Most developers run Postgres in Docker, where there is none — so
the script could not be run at all on the machine that wrote it. `MIGRATION_AUDIT_PSQL` takes a
full command:

```
MIGRATION_AUDIT_PSQL="docker exec -i my-pg psql -U postgres" npm run migration:audit
```

Not a convenience. An unrunnable verifier is precisely what A38 is about, and shipping one
without ever executing it would have repeated this build's own subject.

## SKIPPED is not a pass, and says so

With no Postgres the script exits 0 and prints, in as many words, *"This is not a pass."* A
developer must not be blocked; CI must not be able to think the check ran when it did not. The
two needs are met by saying which happened rather than by picking one.
