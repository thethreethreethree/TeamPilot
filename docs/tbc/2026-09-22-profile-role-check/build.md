# BUILD — the column that decides who is an admin accepts any string

## What was built

One migration. No application change: `roles.ts` was never wrong, and nothing in `src/` writes a
role the new constraint rejects.

### `profiles_role_check`

- **write-path:** `supabase/migrations/0266_profiles_role_check.sql` — drops the constraint if
  present, then adds it over the 9 invitable roles + `admin` + `member` + NULL.
- **read-path:** Postgres, on every insert and update to `profiles.role`. There is no application
  code to consult it; that is the point of putting it here rather than in a validator.

The valid set is from the record, not from what a role column ought to hold — three writers read
in the source, and one count against production. See the migration header for both.

### The ordering of the predicate, which is not cosmetic

- **write-path:** the `check (...)` body in 0266 — `role in (…)` first, `or role is null` second.
- **read-path:** `scripts/enum-coverage-audit.mjs`, whose CHECK matcher requires the column and
  its list adjacent to the opening paren. It is the only consumer, and it is a silent one: it does
  not report a CHECK it cannot parse, it simply does not count it.

```sql
check (
  role in ( … )
  or role is null
)
```

Semantically identical to the null branch first, and **not identical to the tooling**.
`enum:audit` matches `check\s*\(\s*(col)\s+in\s*\(` — the column and its list adjacent to the
opening paren. Written the other way round, this constraint is invisible to that audit and the
column silently never becomes available as a mirror subject.

Confirmed by running it: `CHECK-constrained sets: 105 → 106`. 0239 made the same ordering choice
for a related reason and wrote it down; this is that note one migration later, from the other side.

## What was deliberately NOT built

**No `STORABLE_PROFILE_ROLES` constant.** Declaring a mirror would give the drift gate a third
subject, which was half the appeal of the founder's option. It would also be an exported constant
nothing in the product consumes — the A31 shape flagged this morning on `profile_departments`,
where a read and two writers exist and no surface calls any of them.

The three role constants that DO exist are each correct about their own question and none is about
storability: `ASSIGNABLE_ORG_ROLES` (8, what an admin may assign), `INVITABLE_ROLES` (9, what an
invitation may hold), `ADMIN_ROLES` (4, who is an admin). The constraint's comment says plainly
that adding a role to `ORG_ROLE_OPTIONS` means adding it here too, and that nothing compares them.

## Ripple

- **No data is rewritten.** The lowercase `member` row stays exactly as it is; the constraint
  accommodates it. Normalising it first was the option the founder did not pick, and it is a write
  to a real person's record.
- **`/api/team/set-role`** already validates against `isAssignableOrgRole` (the 8). The constraint
  is strictly wider, so no currently-reachable write becomes a 500.
- **Invite acceptance** inserts a role already constrained to the 9 by `team_invitations_role_check`.
- **The onboarding RPC** writes `'admin'`, which is in the set.
- **`ADD CONSTRAINT` takes an ACCESS EXCLUSIVE lock and scans the table.** 24 rows makes that
  irrelevant here; recorded because the same statement on a large table is a different event.
