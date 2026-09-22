# CHECK — the gap three builds in a row have asked for

## The canonical gate

```
$ PGUSER=… PGPASSWORD=… MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" \
  MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

Twelve steps now — `sql:harness` between `migration:audit` and `tbc`.

## The harness against real Postgres

```
$ npm run sql:harness
═══ SQL harness — the claims only executed SQL can check ═══
  Database:  sql_harness_scratch (rebuilt — the migration set moved, key 876e428c)
  ✓ unreviewed_violation_flags excludes a flag that has an override
  ✓ the view is security_invoker in the database, not just in the migration
  ✓ profile_departments admits an admin and refuses a member

✓ 3 claim(s) checked against real Postgres.
```

Three residuals, filed by three separate builds today, now rest on an execution rather than a mock.

## The cost, measured

```
$ time npm run sql:harness      # second run
  Database:  sql_harness_scratch (reused, key 876e428c)
  ✓ 3 claim(s) checked against real Postgres.
real    0m0.191s
```

**0.19 seconds on reuse**, against ~2 minutes to replay 264 migrations. If it cost the latter every
time, it would be the first thing anyone disabled.

## Probes — run, not reasoned about

**The claims fail when the thing they check is broken.** `create or replace view` in the harness
database, dropping both the anti-join and `security_invoker`:

```
✗ unreviewed_violation_flags excludes a flag that has an override
    an overridden flag must leave the view, saw 1
✗ the view is security_invoker in the database, not just in the migration
    expected security_invoker=true, saw null
✓ profile_departments admits an admin and refuses a member
```

Two failures, each with the message it was written for, and the unrelated claim unaffected.

**The staleness key moves in all three directions** — and the third is the one that matters:

| Change | Key |
|---|---|
| baseline | `876e428c` |
| a migration ADDED | `ac57c871` → rebuilt |
| that migration REMOVED | `876e428c` → rebuilt |
| an existing migration EDITED, file count unchanged | `4e72c53c` → rebuilt |

A count-based key misses the last one. An mtime-based key fires on the first two and on nothing
at all. Contents was the only version that survives the probe.

## What the tests cover, and what they cannot

`scripts/__tests__/sql-harness.test.ts`, 8 cases, **none of which needs a database** — they run the
harness pointed at a port nothing listens on:

| Case | The defect it names |
|---|---|
| exits 0 when unreachable | blocking every developer without Postgres |
| says "THIS IS NOT A PASS" | **the harm case** — a silent skip reading as verification |
| names each unchecked claim by its database object | a reader not knowing what they are not being told |
| says WHY it could not connect | "no Postgres" meaning two different things needing two different fixes |
| says how to fix it | a dead-end banner |
| hashes contents, not names alone | a stale database reporting success |
| uses its own database | racing the migration audit |
| rolls back in `finally` | one claim's rows reaching the next |

**They cannot assert the claims themselves.** That needs a database, and pretending otherwise is
exactly the failure this build exists to end. The claims rest on the run whose output is pasted
above, and on nothing else.

---

## Findings

### I have called this the "twelve-step gate" all session, over eleven steps

class: a count repeated from memory instead of from the thing counted. Not a typo — it was written
  five times, in five separate build records, each time as a statement of fact about the gate.
severity: low in consequence, and worth recording for its shape.
sweep: `grep -rl "Twelve steps" docs/tbc/` — five files, all corrected in place.

- The gate was: typecheck, lint, theme, rls, invariant, reachability, writer, enum, migration, tbc,
  test. **Eleven.**
- Adding `sql:harness` makes it twelve — which means the claim became true today, by accident,
  after being wrong every previous time it was written.
- That is the uncomfortable part and the reason it is a finding rather than a fix: a number that
  becomes correct later was still wrong when it was written, and the correction says so rather than
  letting the new count quietly ratify the old claim.
- Found by counting `p.scripts.check.split("&&").length` after the edit, and noticing it said 12
  when I expected 13.

## What this run does not cover

- **The third residual is only partly closed.** `listFiles`' `!inner` embed is a PostgREST
  construction, and PostgREST is not in this harness — the database is. What the harness can check
  is the SQL the embed compiles to, and it does not yet. Named in the residual.
- **CI has no credentials for this yet**, so it will skip there until they are set. Loudly.
