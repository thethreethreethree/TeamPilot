# REMEDIATE — one decision, forty-eight copies, one of them edited

### Two authorities for one decision, in two languages, with nothing comparing them

gate-or-promise: promise

0265 takes the admin-role list from 48 places to 2: `ADMIN_ROLES` in `src/lib/roles.ts` and
`admin_roles()` in the database. That is the fix the founder asked for and it is a large
reduction. It is also, honestly, still two.

**The same drift remains possible.** Edit the constant and not the function — one edit instead of
forty-seven, and exactly as silent. The original took 24 days to surface and only because someone
read one table's RLS for an unrelated reason.

**Why a promise and not a gate, this time.** The gate is buildable and its shape already exists:
`enum:audit` compares a declared TypeScript mirror against a SQL CHECK set, opting in through a
`// enum-source: table.column` marker. This case needs the same idea pointed at a function's
return value rather than a constraint — an extension of that audit, not a use of it.

Building it inside this commit would mean the audit's first run happens in the same change that
rewrites what it audits. If it passed, that would prove nothing: it would be comparing two things
I had just written to agree. A gate's first run should be against a state it did not help create.

So: 0265 lands, and the audit extension is the next build, with its first run against 0265 as it
stands. Named here so it is asked for rather than forgotten.

```
grep -n "ADMIN_ROLES" src/lib/roles.ts
select prosrc from pg_proc where proname = 'admin_roles';
```

Two places. Nothing in the twelve gates reads both.

### The gate's shape, sketched so the next build does not start cold

gate-or-promise: promise

(The same promise as above, with its design worked out rather than gestured at. Recorded as a
second entry because a promise whose shape is known is a different thing from one that is not.)

Read `scripts/enum-coverage-audit.mjs` while this one's gate was running. The extension is smaller
than it looked:

- **The marker** is `const MARKER = /\/\/\s*enum-source:\s*([a-z0-9_]+)\.([a-z0-9_]+)/gi` — a
  `table.column` pair. A function needs a second form, e.g. `// sql-source: admin_roles()`.
- **The source** is parsed from the migration files, whole-file rather than line-by-line, with
  `check\s*\(\s*(col)\s+in\s*\(([\s\S]*?)\)` and attributed to the nearest preceding table
  statement by position. A function's array literal parses the same way:
  `create\s+(or\s+replace\s+)?function\s+...admin_roles\(\)[\s\S]*?array\[([\s\S]*?)\]`.
- **Last definition wins**, deliberately, "because a migration that drops and re-adds a constraint
  is REPLACING it". `create or replace function` has exactly that semantics, so the rule carries
  over unchanged.
- **Opt-in, so zero false positives by construction** — nothing is audited that has not declared
  itself a mirror. That property is the reason this audit was kept when the inferred version was
  abandoned this morning, and it must survive the extension.

One caution the existing file records and the extension inherits: its first run was WRONG about the
very table it was built for, because a line-scanner saw a single-line CHECK and missed every
multi-line one. A function body is multi-line by habit. Whole-file matching from the start.
