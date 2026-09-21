# BUILD — a migration that cannot apply is a deployment blocker whatever the tests say

### The apply audit: every migration, against real Postgres, twice

- write-path: `scripts/migration-apply-audit.mjs` (new) — creates a scratch database, applies the
  shim, then applies all 252 migrations **twice**. The scratch database is dropped at the end, so
  the script leaves nothing behind on a developer's server.
- write-path: the two passes are graded differently, and that asymmetry is the design:

  | Pass | Meaning | Grading |
  |---|---|---|
  | fresh apply | can this reach production at all? | **fatal** |
  | re-apply | A12, safe-to-re-run by construction | 18 baselined; fails on a **new** one |

- write-path: **18 of 252 are not re-runnable** — all `create policy` / `create type` /
  `create index` without a matching `drop … if exists`. They have RUN in production, so they are
  append-only and must not be edited to fix a problem already in the past. They are a named
  baseline (`NOT_RERUNNABLE_BASELINE`) and the gate fires only when a *new* one appears. Fixing
  history is a separate build; stopping the bleed is this one.
- write-path: the script also reports when a baseline entry starts *passing*, so the list shrinks
  instead of calcifying — a baseline that can only grow is an allowlist that eventually means
  nothing.
- read-path: `npm run migration:audit`, wired into `npm run check` after `reachability:audit`
  (`package.json`). A developer running the project's own gate runs this.
- read-path: `.github/workflows/ci.yml` — a `postgres:16-alpine` service with a health check and
  the step that uses it. Job timeout 10 → 15 minutes. CI is where it is not skippable.

### The Supabase shim — the smallest stand-in for what exists before migration 0001

- write-path: `scripts/sql/supabase-shim.sql` (new). Its contents are justified by a grep of what
  the 252 migrations actually touch, not by guessing:

  ```
  448  auth.uid()      98  auth.users     17  storage.objects
    9  storage.foldername  6  storage.buckets   3  auth.jwt()
  ```

- write-path: it is deliberately minimal. A shim that invents structure the real platform does not
  have would make migrations pass here and fail in production — the exact inversion of the bug this
  build exists to catch.
- read-path: consumed only by the audit script; nothing in `src/` reaches it, and nothing should.
  A gap in it fails **loudly** — four migrations failed on the first run because `storage.buckets`
  was missing `file_size_limit`, which is that failure mode working correctly.

### Runnable on the machines developers actually have

- write-path: `MIGRATION_AUDIT_MAINT_DB` — the maintenance database to connect to while creating
  the scratch one. Previously hard-coded to `postgres`.
- write-path: `MIGRATION_AUDIT_PSQL` — a full command rather than a path, so a containerised
  Postgres works:

  ```
  MIGRATION_AUDIT_PSQL="docker exec -i my-pg psql -U postgres" npm run migration:audit
  ```

- read-path: with no Postgres reachable the script exits 0 and prints, in as many words,
  *"This is not a pass."* A developer must not be blocked; CI must not be able to think the check
  ran when it did not. Both needs are met by **saying which happened** rather than by picking one.
- read-path: CI has a Postgres service, so the skip path cannot be how it passes there.
