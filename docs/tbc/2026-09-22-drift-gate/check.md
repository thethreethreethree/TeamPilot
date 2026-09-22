# CHECK — two is better than forty-eight and it is still two

## The canonical gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

## The audit against the real repository

```
$ npm run enum:audit
  CHECK-constrained sets: 105
  Declared mirrors:       9
✓ Every declared mirror matches its CHECK set exactly.
```

104 → 105 sets: exactly one function source in 263 migrations, `admin_roles()`.
8 → 9 mirrors: `ADMIN_ROLES` at `src/lib/roles.ts:45`.

## Mutation probes — the real repository, not a fixture

**The 2026-08-29 drift, reproduced.** Drop `"CFO"` from `ADMIN_ROLES` and run the gate:

```
✗ 1 mirror(s) out of step with the database:
  • admin_roles()   src\lib\roles.ts:45
      MISSING: CFO
```

**The other direction**, which is the more dangerous half — authority the application would grant
and RLS would silently refuse. Add `"CTO"`:

```
✗ 1 mirror(s) out of step with the database:
  • admin_roles()   src\lib\roles.ts:45
      NOT IN THE DATABASE: CTO
```

**The parser's own boundary.** Revert the function-body match to the unbounded form the first
version had:

```
Tests  5 failed | 12 passed (17)
```

## Six new tests, and what each would have caught

| Case | The defect it names |
|---|---|
| the function has a role the constant does not name | **the incident** — the 2026-08-29 drift |
| a role the app grants the database has never heard of | authority offered and silently refused |
| they agree | the gate firing on a correct state |
| `ceo` vs `CEO` is a finding | a case-insensitive comparison that never fires |
| does not read past the function body | the bug the first version had, below |
| a marker naming a function that does not exist | the opt-in design's one real risk: silence |

---

## Findings

### The parser I wrote for this audit had the exact bug this audit exists to catch

class: a parser whose failure mode is reading something other than what is there, reporting a
  verdict indistinguishable from a correct one. The existing audit records the same class in its
  own history: a line-by-line scanner read `manager_notifications.type` as a two-value set and
  called four correctly handled values "not in the database".
severity: high — it reported success, which is the worst possible output for a wrong parser.
sweep: print what a parser matched, on the real corpus, rather than reading its verdict. For this
  one: `node` over `supabase/migrations/*.sql` listing every `(function, values)` pair it extracts.
  Nothing static finds it; only the extracted values do.

- The first version matched
  `function NAME\(\)[\s\S]*?array\[…\]` — non-greedy, and still unbounded. `[\s\S]*?` happily
  leaves the function and finds the next `array[...]` anywhere later in the file.
- Against the real migrations it reported four sources, of which **three were wrong**:

  ```
  0001_init.sql            | auth_company_id => ["tasks","team_members","decisions","conversations"]
  0002_understanding_gate  | check_understanding_gate => ["signals","problems"]
  0038_care_white_label    | touch_care_tenant_config_updated_at => ["https://elostate.com", …]
  ```

  None of those lists is in the function it was attributed to. `auth_company_id()` returns
  `select company_id from profiles where id = auth.uid()` and contains no array at all.
- **The audit reported success while doing this**, because the opt-in design meant no mirror had declared
  any of those keys, so nothing was ever compared against a wrong set. The design contained a bug
  it could not prevent — which is a good property and not a substitute for the parser being right.
- Found by printing the extracted pairs. The verdict would never have shown it.
- Fixed by matching the dollar-quoted body (`$$ … $$`, `$function$ … $function$`) with a
  backreference to its own tag, and searching for the array inside that. The real corpus now
  yields exactly one source: `admin_roles() => ["CEO","CFO","COO","admin"]`.

## What this run does not cover

- **A function whose list is not a literal array.** `select enum_range(...)`, a table lookup, a
  `case` expression — none is parsed, and a marker pointing at one fails as "no function named …
  returning a value list", which is honest but unhelpful. Recorded in the residual.
- **No browser, no database.** The audit is static analysis over files; the SQL half of the claim
  it enforces was exercised against real Postgres in the 0265 build.
