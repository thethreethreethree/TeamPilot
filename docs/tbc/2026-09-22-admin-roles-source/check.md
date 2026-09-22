# CHECK — one decision, forty-eight copies, one of them edited

## The canonical gate

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check
$ echo "CHECK_EXIT=$?"
CHECK_EXIT=0
```

ELEVEN steps at the time of this run — "twelve" was wrong here and in four other build records, corrected 2026-09-22 when `sql:harness` made it twelve for real. Output redirected to a file, exit code read on the next line, never through a
pipeline.

## Before applying anything: does production match what the migration was generated from?

**The risk.** 0265 re-creates 47 policies from a snapshot of `migration_audit_scratch` — a database
built by replaying the migration history. If production's policies had ever been edited by hand in
the Supabase dashboard, applying this would silently reset them, and because the file is generated
that diff would never appear in a review.

Settled by comparison, in three independent ways. Schema metadata only; no user data in any query.

| Check | Live | Scratch |
|---|---|---|
| policies in `public` | 322 | 322 |
| matching the admin literal | 47 | 47 |
| by command | 18 SELECT · 11 INSERT · 8 UPDATE · 8 ALL · 2 DELETE | same |
| permissive / grantee | all PERMISSIVE, all `to public` | same |

Then the one that settles it — the live definitions rebuilt into the same DDL shape the generator
produced, both normalised for whitespace (they differ in line wrapping, not in SQL):

```
scratch-generated: 21343 chars
live-generated:    21343 chars
IDENTICAL
```

Production has not drifted from the migration history. The first two checks would each have passed
with a real difference hiding inside them; the third is the evidence.

## Structural probe — against real Postgres, after applying 0265 to the scratch database

```
=== every policy that used the literal now calls the function ===
 calls_fn | still_literal
----------+---------------
       47 |             0

=== total policy count unchanged (expect 322) ===
   322

=== the four roles are admin; everything else is not ===
 CEO t · CFO t · COO t · admin t · VP f · Director f · Manager f · Member f · member f · (null) —
```

## Behavioural probe — a CFO, impersonated the way Supabase does it

Not a text search over `pg_policies`. `set local role authenticated` plus the setting `auth.uid()`
actually reads, then real writes against real policies. Rolled back.

```
=== impersonation works ===
 uid: bbbbbbbb-…-0001 | acting_as: CFO

=== as the CFO: create a department ===
INSERT 0 1        → cfo_created_departments = 1

=== as the CFO: put a person in a department ===
INSERT 0 1        → cfo_created_assignments = 1

=== as a Member: the SAME write must still be refused ===
ERROR: new row violates row-level security policy for table "departments"
                  → member_created_departments = 0
```

The second one is `profile_departments` — the policy whose tenant check joins `profiles me` to
`profiles target`, and the reason the whole design avoids rewriting tenant scopes by hand.

**The A/B, which is the part that proves the seam exists.**

Change **only the function**, put the old three-role list back, change nothing else:

```
create or replace function public.admin_roles() … select array['CEO','COO','admin']

=== as the CFO, same statement, same policies ===
ERROR: new row violates row-level security policy for table "departments"
                  → cfo_created_with_old_list = 0
```

The 47 policies consult `admin_roles()` **at execution time**. That was risk 6 in the think doc —
that a `STABLE` function might be folded into the policy at creation time, making the single source
an illusion — and it is now measured rather than argued.

## Three bugs in the probe itself, each of which would have reported a wrong answer

A probe that lies is worse than no probe, and this one lied twice before it told the truth.

1. **`auth.uid()` reads `request.jwt.claim.sub` — singular** — in this scratch database, not the
   `request.jwt.claims` JSON the real Supabase function parses. Setting the wrong one returns null,
   every policy denies, and the probe "proves" a CFO is refused. Caught by reading
   `pg_get_functiondef` *before* writing the probe rather than after it produced a confusing result.
2. **`\echo` prints after a failed statement.** The first run printed
   `!!! A MEMBER JUST CREATED A DEPARTMENT !!!` when the member's insert had in fact been refused —
   psql echoes regardless of the aborted transaction. Every assertion is now a `SELECT` whose output
   is the evidence, inside a savepoint so one refusal does not abort the rest.
3. **The `authenticated` role had no grants here.** Supabase's platform grants table privileges;
   a local replay of the migration history does not, so the probe supplies them inside the
   transaction. RLS still applies on top of a grant for a non-owner role — that layering is what
   makes this a reproduction and not a bypass.

---

## Findings

### The gap this build does NOT close

class: two authorities for one decision, in two languages, with no check comparing them. 0265
  reduces 48 copies to 2 — `ADMIN_ROLES` in TypeScript and `admin_roles()` in SQL — which is a
  large improvement and is still two.
severity: medium
sweep: `grep -n "ADMIN_ROLES" src/lib/roles.ts` and
  `select prosrc from pg_proc where proname='admin_roles'`. Two places, and nothing in the twelve
  gates reads both.

- The drift that caused this took **24 days** to be noticed (2026-08-29 → 2026-09-22), and only
  because someone read one table's RLS for an unrelated reason.
- After 0265 the same drift is still possible: edit the constant, not the function. It would be
  one edit instead of forty-seven, and just as silent.
- What would close it is a gate comparing the two — the `enum:audit` shape, which already compares
  a declared TypeScript mirror to a SQL CHECK set with an opt-in `// enum-source:` marker. The
  source here is a function's return value rather than a constraint, so it is an extension of that
  audit, not a use of it.
- **Not built here.** A migration that rewrites 47 policies and a new audit are two builds, and
  bundling them would mean the audit's first run happens in the same commit that changes what it
  audits. Carried to the residual as the next step.

## What this run does not cover

- **The live apply.** Everything above is against the scratch database. `db:apply` and
  `verify:live`'s 30 invariants are the next step and their output belongs in the closure, not here.
- **No browser.** No surface changed, so there is nothing to render — the first build today where
  that is the honest answer rather than an omission.

## The three gates most likely to be broken by this, run directly

Not as part of the twelve-step run — individually, because these are the ones a migration that
rewrites 47 RLS policies would break:

```
$ npm run rls:audit
  Tenant-pin risks:      0
  Missing policies:      0
  RLS-bypassing views:   0
✓ Every table has RLS enabled, every operation is covered or documented, every update/all
  policy pins the tenant on write, and every view runs as the invoker.

$ npm run invariant:audit
  Violations:           0
✓ … no client-callable DEFINER tenant-param fn · every admin route gated · …
```

`rls:audit` seeing zero missing policies is the specific thing the `AS PERMISSIVE` omission exists
for. `invariant:audit`'s DEFINER check passing confirms `admin_roles()` is outside INVARIANT 4's
scope by construction rather than by luck.

**Re-runnability, by hand, before the audit reached it:** the whole migration applied a SECOND time
against the same database — exit 0, policy count still 322. `create or replace` and
`drop policy if exists` do what the header claims (A12).

## The probes are committed, not just described

`probe-structural.sql` and `probe-behaviour.sql` live in this build directory. A probe described in
prose is a claim; a probe someone else can re-run is evidence, and the behavioural one carries
three hard-won corrections in its header that anyone writing the next RLS probe against this
database will otherwise rediscover the slow way.

```
docker exec -i ics-postgres psql -U ics -d migration_audit_scratch -f - < probe-behaviour.sql
```
