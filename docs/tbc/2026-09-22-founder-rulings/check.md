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

---

## Addendum — the enum audit and 0263

### 0263, against the live database

```
$ npm run db:dry
[db-apply] 1 pending migration(s): 0263_clip_disputed_notification.sql

$ npm run db:apply
[db-apply] applying 0263_clip_disputed_notification.sql … ok
[db-apply] applied 1 migration(s). DB now at 0263.
✅ ALL 30 invariants hold.

$ npm run db:dry
[db-apply] nothing pending — DB is up to date.
```

### The measurement that said no

Four versions of the inferred rule, each run against the full schema, each hand-checked:

| version | findings | verified |
|---|---|---|
| v1 any literal | 9 | ≥2 provably false (`"lost"` collision; `"ai"` excluded by a 3-char floor while being handled) |
| v2 2+ values in one file | 6 | still colliding on ordinary words |
| v3 + site names its table | 4 | 3 hand-checked, all false |
| v4 + comments stripped | 3 | **all three correct code** — state-transition routes |
| alt TS unions | 59 | dominated by colour-name collisions |

The three survivors of v4, each opened and read:

- `fin_bank_transactions.status` — writes `"ignored"`, guards on `"unmatched"`. Never needs
  `"matched"`.
- `fin_expense_reports.status` — `draft → submitted`. The other statuses belong to other routes.
- `smoke_test_results.status` — `body.status === "fail" || body.status === "unable"` requires a
  note; `"pass"` correctly needs none.

Reported as "the rule is wrong" rather than allowlisted, because the false-positive rate grows with
every new transition route.

### The declared-mirror audit

```
CHECK-constrained sets: 104
Declared mirrors:       1
✓ Every declared mirror matches its CHECK set exactly.
```

104, not 99 — five sets were invisible to the line-by-line parser that shipped in the first draft.

### The probe

Revert the bell's union to this morning's three values:

```
✗ 1 mirror(s) out of step with the database:
  • manager_notifications.type   NotificationBell.tsx:41
      MISSING: recording_comment, recording_share_requested, pattern_coached, pattern_clip_disputed
```

### Mutation testing the audit

| # | Mutation | Outcome |
|---|---|---|
| 1 | invented-value check dropped | caught |
| 2 | missing-value check dropped | caught |
| 3 | an unknown marker ignored instead of reported | caught |
| 4 | SQL comments not stripped | **survived → fixture corrected** |
| 5 | always `exit(0)` | caught (3 tests) |
| 6 | multi-line CHECK back to single-line | caught (2 tests) |

**Mutant 4's survival was a defect in my test, not in the audit.** The fixture put the phantom
comment BEFORE the real definition, so last-definition-wins overwrote it and the test passed either
way — it proved nothing. Moved after, which is also the realistic case: a migration documenting the
set it just replaced. Plus a block-comment variant.

### Tests

| Suite | Count |
|---|---|
| `enum-coverage-audit.test.ts` | 11 |
| `patterns/event/route.test.ts` (clip-dispute block) | +4 |
| `NotificationBell.render.test.tsx` (the alert that points back) | +3 |
