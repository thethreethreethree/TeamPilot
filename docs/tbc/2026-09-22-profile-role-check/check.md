# CHECK — the column that decides who is an admin accepts any string

## The canonical gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

## Behavioural probe — real Postgres, real constraint, rolled back

`docs/tbc/2026-09-22-profile-role-check/probe.sql`, committed rather than described.

```
=== every role live in production must still be storable ===
INSERT 0 5        → live_values_accepted = 5     (admin, Member, null, Manager, member)

=== every role a writer can produce must be storable (the 9 + admin) ===
INSERT 0 10       → reachable_values_accepted = 15

=== THE DEFECT: a typo must now be REFUSED ===
ERROR: new row for relation "profiles" violates check constraint "profiles_role_check"
                  → typo_accepted = 0

=== and an UPDATE to a typo is refused too, not just an insert ===
ERROR: new row for relation "profiles" violates check constraint "profiles_role_check"
                  → typo_updated = 0
```

The **update** case is the one that matters most: `/api/team/set-role` changes a role by update,
and an insert-only guard would have left the most likely path open.

## Re-runnable, by hand, before the audit reached it

The whole migration applied a second time against the same database: `ALTER TABLE`, `COMMENT`,
no error. `drop constraint if exists` before `add constraint` does what the header claims (A12).

## The ordering finding, measured rather than argued

```
$ npm run enum:audit          # with `check (role is null or role in (…))`
  CHECK-constrained sets: 105

$ npm run enum:audit          # with `check (role in (…) or role is null)`
  CHECK-constrained sets: 106
```

One reordering, same semantics, and the difference between a column that can be a mirror subject
and one that silently cannot.

## The gates most likely to be disturbed, run individually

```
$ npm run rls:audit
✓ Every table has RLS enabled, every operation is covered or documented, every update/all
  policy pins the tenant on write, and every view runs as the invoker.

$ npm run enum:audit
  CHECK-constrained sets: 106
  Declared mirrors:       10
✓ Every declared mirror matches its CHECK set exactly.
```

---

## Findings

### A CHECK written the natural way would have been invisible to the audit that reads CHECKs

class: a formulation that is correct to the database and unreadable to the tooling that depends on
  it. Not a bug in either — the SQL is right, the parser is reasonable — but the two have a
  contract nobody wrote down, and only one side knows it exists.
severity: low — nothing breaks; a future capability quietly never becomes available.
sweep: `grep -n "check (" supabase/migrations/*.sql | grep -v " in ("` finds every CHECK the enum
  audit cannot read. Most are genuinely not value sets (length, range, cross-column); the question
  is only whether any of them is a set written in a shape the parser misses.

- `check (role is null or role in (...))` is the way that predicate wants to be written, and the
  audit's regex requires `col in (` adjacent to the opening paren.
- Caught by checking the set count after applying, not by reading the regex. 105 → it had not
  moved → the constraint existed and the audit could not see it.
- Reordered. The general fix — teach the parser to find `col in (...)` anywhere inside a CHECK —
  is NOT done, and the reason is in remediate.md.

## What this run does not cover

- **The live apply.** Everything here is the scratch database. `db:apply` and `verify:live` come
  next and belong in the closure.
- **No browser.** A constraint has no surface.
