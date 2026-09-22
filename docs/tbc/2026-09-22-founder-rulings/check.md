# CHECK — three rulings

## The canonical gate

```
$ npm run check
```

Now eleven steps: `typecheck && lint && theme:audit && rls:audit && invariant:audit &&
reachability:audit && writer:audit && migration:audit && tbc && test`. Exit code on its own line
(A38). Result in closure.md.

## The migration, against the live database

```
$ npm run db:dry
[db-apply] 1 pending migration(s): 0262_pattern_notifications.sql

$ npm run db:apply
[db-apply] applying 0262_pattern_notifications.sql … ok
[db-apply] applied 1 migration(s). DB now at 0262.
✅ ALL 30 invariants hold.
[db-apply] ✓ verify:live passed

$ npm run db:dry
[db-apply] nothing pending — DB is up to date.
```

The second dry run is the idempotence check (A12): re-running finds nothing pending.

## The new gate, measured before it was called precise

This is the part the founder's ruling actually asked for, so the numbers are the deliverable.

```
Tables defined:        153
Views (exempt):         60
Tables read by src:    158
Tables written by src: 117
Written by SQL only:    30
Allowlisted:             4
```

**First run against the real repository: one finding.** Not zero — which would have been
suspicious — and not forty, which would have meant the rule was wrong. `smoke_test_versions`,
read by two routes and written by two operator scripts over the REST API. Allowlisted with both
scripts named.

The three pre-existing allowlist entries are Supabase-managed tables (`auth.users`, `users`,
`storage.objects`) that the application reads and never writes.

## The probe

An emptied finding list and a broken gate look identical. Same technique that re-proved the
migration audit:

```
--- PROBE: writer removed, the pre-build state ---
✗ 1 table(s) read by the product that NOTHING writes:
  • pattern_events
      read by src\lib\coach\patterns\readPatterns.ts

--- restored ---
✓ Every table the product reads has something that writes it.
```

It names the exact table and the exact reader that no gate could see for three builds.

## Mutation testing the gate itself

A gate that cannot fail is a green light with extra steps. 6 mutants:

| # | Mutation | Outcome |
|---|---|---|
| 1 | test files counted as writers | caught (2 tests) |
| 2 | SQL comments not stripped | caught |
| 3 | views not exempt | **survived → test added** |
| 4 | SQL writers ignored | caught (4 tests) |
| 5 | only `insert` counts as a write | caught (2 tests) |
| 6 | always `exit(0)` | caught (4 tests) |

**Mutant 3 survived, and unlike this morning's tie-break it was NOT equivalent.** A view is
normally absent from the table set too, so the next check catches it and the exemption never
decides anything — today. The case where it decides is a table dropped and replaced by a view of
the same name, which this codebase has done in spirit (`rep_activity` → `rep_kpi_daily`). I
checked: zero names are currently both. So the line is reachable and untested rather than dead,
and it got a test with that fixture — a `create table`, a `drop table`, and a `create view` under
one name.

That is the second time today the same question has come up with opposite answers, and the
difference is worth naming: a line that **cannot** change any output is deleted; a line that
**could** but never has is tested. Guessing which one you are looking at is how an inert guard
survives and a live one gets removed.

## The bell, mutation-tested at the branch that was missing

| Mutation | Outcome |
|---|---|
| `pattern_coached` falls through to the generic branch — the pre-fix behaviour | caught by 3 tests |

The third of those is the one worth naming: *"never tells a rep that a rep closed a deal about
their own coaching"* asserts the **exact wrong sentence** the fall-through produced, rather than
only asserting the right one. A test that checks the correct string passes on a branch that
happens to be unreachable; a test that checks the wrong string cannot.

## Tests

| Suite | Count |
|---|---|
| `scripts/__tests__/writer-audit.test.ts` | 15 |
| `patterns/event/route.test.ts` (notification block) | +6 |
| `PatternActions.render.test.tsx` (drill block) | +5 |
| `NotificationBell.render.test.tsx` (three unknown types) | +8 |
| **new this build** | **34** |

The audit's tests build throwaway repositories rather than asserting against today's tree —
`create table` + a reader and nothing else, then one variant per writer category. Asserting "it
exits 0 on this repo" would pass forever after someone broke it.

## Not opened

No image, icon or graphic asset was created, edited, moved or restyled during verification.
