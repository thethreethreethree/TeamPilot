# BUILD — the gap three builds in a row have asked for

## What was built

`scripts/sql-harness.mjs`, wired into `npm run check` as `sql:harness`, with three named subjects
and no ambition beyond them.

### The claims

- **write-path:** `scripts/sql-harness.mjs`. Each claim runs in its own transaction and is rolled
  back in a `finally`, so a claim that throws cannot leave rows for the next one.
- **read-path:** `npm run check`, step 10 of 12. A harness nothing runs is the same shape as the
  problem it was built for (A31), so it goes into the gate in this build or it does not count.

| Claim | What it catches that nothing else can |
|---|---|
| `unreviewed_violation_flags` excludes a flag with an override | a change to the view's `where` clause — 0264's own residual |
| the view is `security_invoker` **in the database** | a `create or replace view` that silently drops it; `rls:audit` reads the migration TEXT, which would still say it |
| `profile_departments` admits an admin, refuses a member | the RLS policy that IS the department route's authority |

The second is A30's own incident made checkable: 19 views once read across the tenant boundary
because `security_invoker` was missing, one of them exposing every tenant's taxpayer IDs.

### Its own database, and why not the other one

- **write-path:** `sql_harness_scratch`, built by replaying every migration through the same
  Supabase shim the migration audit uses.
- **read-path:** `ensureDatabase()` on every run.

**Not `migration_audit_scratch`.** That one is dropped and recreated by the migration audit on
every run, and reading a database while another process rebuilds it produced a wrong policy count
earlier today that was reported as fact and had to be corrected — a partial answer to a counting
query looks exactly like a complete one.

### The staleness key

- **write-path:** `migrationKey()` — a sha256 over the NAME AND CONTENTS of every migration file,
  stored in `_harness_meta` inside the database it describes.
- **read-path:** `ensureDatabase()` compares and rebuilds only on a change.

Replaying 264 migrations takes ~2 minutes. **Reuse takes 0.19 seconds**, measured. That difference
is the whole reason this is affordable inside the gate.

Contents, not a count and not an mtime — a count misses an edit and an mtime moves when nothing
did. Probed all three ways; see check.md.

### The skip

- **write-path:** `unreachableReason()` and the banner it prints.
- **read-path:** `scripts/__tests__/sql-harness.test.ts`, five cases on the skip path alone.

A skip that reads as a pass is the single most likely way this file causes harm: it would turn
three honest residuals into three false assurances, which is strictly worse than not building it.
So it exits 0, says **THIS IS NOT A PASS**, names each unchecked claim *by its database object*,
says why it could not connect, and says how to fix it.

That shape is borrowed rather than invented — `migration-apply-audit.mjs` learned it against a
healthy postgres:16 container reporting `role "postgres" does not exist` into a catch block.

## Ripple

- **`npm run check` gains a step**, between `migration:audit` and `tbc`. It is 12 steps now — and
  was ELEVEN before, not twelve as five build records this session claimed. Corrected in all five.
- **CI needs credentials** to run it for real. Without them it skips, loudly, by design.
- **Nothing in `src/` changes.** No migration, no schema, no surface.
