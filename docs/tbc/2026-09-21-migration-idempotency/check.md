# CHECK

## The audit, before and after

```
BEFORE
  Migrations applied:      254
  Not re-runnable (known): 18
EXIT=0

AFTER
  Migrations applied:      254
  Failed on a fresh DB:    0
  Not re-runnable (known): 0
  Not re-runnable (NEW):   0
EXIT=0
```

Run in this session against a Postgres 16 container
(`MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics"`, `MIGRATION_AUDIT_MAINT_DB=ics`).

## The gate was proven still to bite

An emptied baseline and a gate that stopped working look identical from the outside, so the gate
was tested rather than trusted:

```
  Migrations applied:      255
  Not re-runnable (NEW):   1
✗ NOT RE-RUNNABLE  9999_probe_unguarded.sql
    ERROR:  policy "probe_unguarded - select" for table "probe_unguarded" already exists
EXIT=1
```

Probe removed; back to `Not re-runnable (NEW): 0`, exit 0.

## The chosen option was disproven before it was abandoned

The founder's first answer was *"one new migration that makes all 18 idempotent"*. Rather than
reason about whether that works, it was run: a repair migration was applied after the full history,
then 0001 was replayed exactly as the audit's second pass does.

```
0001 STILL FAILS after the repair migration:
   ERROR:  policy "own profile - select" for table "profiles" already exists
```

A later migration cannot make an earlier one re-runnable, because on any replay the earlier one
runs first. Editing in place is the only thing that reaches zero, and that was taken back to the
founder with the measurement rather than an assertion.

## Gates

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run rls:audit` | 0 missing policies |
| `npm run invariant:audit` | 0 violations |
| `npm run reachability:audit` | 0 unreachable |
| `npm run migration:audit` | 254 / 0 / 0 / 0 |
| `npx vitest run` | 4,762 passed, 15 skipped |

## no findings

The transform was measured at each step rather than trusted: 18 → 3 after the regex rules,
3 → 0 after the two dynamic-SQL edits and the trigger rule, with fresh-apply failures at 0
throughout. Every removed line in the diff was inspected and all were statement rewrites, not
deletions.

## What is NOT verified

- **Nothing was run against production.** Supabase does not re-run an applied migration, so the
  edit is inert there by design — but that is a property of Supabase's migration tracking, stated
  here rather than demonstrated.
- **The files no longer byte-match what production executed.** That is the cost the founder
  accepted. It is mitigated by every edit being additive and headed by its reason, not eliminated.
- **The shim is still hand-written**, so "a database shaped like production" remains an
  approximation.
